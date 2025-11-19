/** WHO Global Health Observatory integration helpers (recreated).
 * API: https://ghoapi.azureedge.net/api
 * Provides dynamic heuristic matching of mortality/incidence/prevalence indicators for disease names.
 */

const WHO_BASE = "https://ghoapi.azureedge.net/api";

export interface RawIndicatorRecord {
	IndicatorCode?: string;
	SpatialDim?: string; // Country code
	Country?: string;
	TimeDim?: string; // Year
	NumericValue?: string; // numeric value
}

export interface DiseaseSummary {
	diseaseKey: string;
	diseaseName: string;
	yearRange: string;
	mortality?: number;
	incidence?: number;
	prevalence?: number;
	topCountries: Array<{ country: string; code: string; deaths?: number; cases?: number }>;
	needScore: number;
	notes: string[];
}

export const DEFAULT_DISEASES = [
	'tuberculosis','malaria','hiv','diabetes','cardiovascular','cancer'
];

interface IndicatorMeta { IndicatorCode: string; IndicatorName?: string; IndicatorDescription?: string; }
let indicatorCache: IndicatorMeta[] | null = null;
let indicatorCacheTime = 0;
const INDICATOR_CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

async function loadIndicators(): Promise<IndicatorMeta[]> {
	const now = Date.now();
	if (indicatorCache && (now - indicatorCacheTime) < INDICATOR_CACHE_TTL_MS) return indicatorCache;
	try {
		const res = await fetch(`${WHO_BASE}/Indicator`);
		if (!res.ok) return indicatorCache || [];
		const json = await res.json();
		indicatorCache = (json.value || []).map((r: any) => ({
			IndicatorCode: r.IndicatorCode,
			IndicatorName: r.IndicatorName,
			IndicatorDescription: r.IndicatorDescription
		}));
		indicatorCacheTime = now;
	} catch (e) {
		// ignore
	}
	return indicatorCache || [];
}

function classify(term: string, indicators: IndicatorMeta[]) {
	const lcTerm = term.toLowerCase();
	const matched = indicators.filter(i => {
		const text = `${i.IndicatorName||''} ${i.IndicatorDescription||''}`.toLowerCase();
		return text.includes(lcTerm);
	});
	const groups: Record<'mortality'|'incidence'|'prevalence', string[]> = { mortality: [], incidence: [], prevalence: [] };
	matched.forEach(m => {
		const txt = `${m.IndicatorName||''} ${m.IndicatorDescription||''}`.toLowerCase();
		if (/death|mortality|fatal/i.test(txt)) groups.mortality.push(m.IndicatorCode);
		if (/incidence|new case|case\b|cases\b/i.test(txt)) groups.incidence.push(m.IndicatorCode);
		if (/prevalence/i.test(txt)) groups.prevalence.push(m.IndicatorCode);
	});
	groups.mortality = groups.mortality.slice(0,5);
	groups.incidence = groups.incidence.slice(0,5);
	groups.prevalence = groups.prevalence.slice(0,5);
	return groups;
}

async function fetchIndicator(code: string): Promise<RawIndicatorRecord[]> {
	try {
		const res = await fetch(`${WHO_BASE}/${code}`);
		if (!res.ok) return [];
		const json = await res.json();
		return json.value || [];
	} catch { return []; }
}

export async function buildDiseaseSummary(name: string): Promise<DiseaseSummary | null> {
	const indicators = await loadIndicators();
	const groups = classify(name, indicators);
	if (!groups.mortality.length && !groups.incidence.length && !groups.prevalence.length) {
		return {
			diseaseKey: name.toLowerCase(),
			diseaseName: name,
			yearRange: '(years unavailable)',
			topCountries: [],
			needScore: 0,
			notes: ['No WHO GHO indicators matched for mortality/incidence/prevalence using heuristic classification.']
		};
	}
	const fetchGroup = async (codes: string[]) => (await Promise.all(codes.map(c => fetchIndicator(c)))).flat();
	const [mortalityRaw, incidenceRaw, prevalenceRaw] = await Promise.all([
		fetchGroup(groups.mortality), fetchGroup(groups.incidence), fetchGroup(groups.prevalence)
	]);
	const years = new Set<string>();
	const addYears = (arr: RawIndicatorRecord[]) => arr.forEach(r => r.TimeDim && years.add(r.TimeDim));
	addYears(mortalityRaw); addYears(incidenceRaw); addYears(prevalenceRaw);
	const sortedYears = Array.from(years).map(y=>parseInt(y)).filter(n=>!isNaN(n)).sort((a,b)=>a-b);
	const yearRange = sortedYears.length ? `${sortedYears[0]}–${sortedYears[sortedYears.length-1]}` : '(years unavailable)';
	const sum = (arr: RawIndicatorRecord[]) => arr.reduce((acc,r)=>acc + (parseFloat(r.NumericValue||'0')||0),0);
	const mortality = mortalityRaw.length ? Math.round(sum(mortalityRaw)) : undefined;
	const incidence = incidenceRaw.length ? Math.round(sum(incidenceRaw)) : undefined;
	const prevalence = prevalenceRaw.length ? Math.round(sum(prevalenceRaw)) : undefined;
	const countryMap: Record<string,{country:string;code:string;deaths?:number;cases?:number}> = {};
	mortalityRaw.forEach(r => { if(!r.SpatialDim) return; const v=parseFloat(r.NumericValue||'0')||0; if(v<=0) return; const k=r.SpatialDim; if(!countryMap[k]) countryMap[k]={country:r.Country||k,code:k}; countryMap[k].deaths=(countryMap[k].deaths||0)+v; });
	incidenceRaw.forEach(r => { if(!r.SpatialDim) return; const v=parseFloat(r.NumericValue||'0')||0; if(v<=0) return; const k=r.SpatialDim; if(!countryMap[k]) countryMap[k]={country:r.Country||k,code:k}; countryMap[k].cases=(countryMap[k].cases||0)+v; });
	const topCountries = Object.values(countryMap).sort((a,b)=> (b.deaths||0)-(a.deaths||0)).slice(0,8);
	const needScore = Math.min(100, Math.round(
		(mortality? mortality/1_000_000 * 40 : 0) +
		(incidence? incidence/10_000_000 * 30 : 0) +
		(prevalence? prevalence/10_000_000 * 20 : 0) +
		(topCountries.length/8)*10
	));
	const notes: string[] = [];
	if (!mortality) notes.push('Mortality not derived (indicator match may be absent).');
	if (!incidence) notes.push('Incidence not derived.');
	if (!prevalence) notes.push('Prevalence not derived.');
	if (notes.length===0) notes.push('Core indicators retrieved successfully.');
	notes.push('Heuristic keyword matching; figures are aggregated sums and may overestimate true burden.');
	return { diseaseKey: name.toLowerCase(), diseaseName: name, yearRange, mortality, incidence, prevalence, topCountries, needScore, notes };
}

export function formatNumber(n?: number): string {
	if (n == null) return '—';
	if (n >= 1_000_000_000) return (n/1_000_000_000).toFixed(2)+'B';
	if (n >= 1_000_000) return (n/1_000_000).toFixed(2)+'M';
	if (n >= 1_000) return (n/1_000).toFixed(1)+'K';
	return String(n);
}

export async function buildDiseaseContext(keys: string[]): Promise<DiseaseSummary[]> {
	const uniq = Array.from(new Set(keys.map(k=>k.trim()).filter(Boolean)));
	const summaries = await Promise.all(uniq.map(k => buildDiseaseSummary(k)));
	return summaries.filter(Boolean) as DiseaseSummary[];
}

