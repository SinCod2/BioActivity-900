import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { Clock, Pill, FlaskConical, Trash2, Calendar, Search } from 'lucide-react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

interface HistoryItem {
  id: string;
  type: string;
  query: string;
  resultCount: number | null;
  details?: any;
  createdAt?: string;
}

export default function HistoryPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dateFilter, setDateFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['history'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/history');
      return res.json();
    },
    refetchInterval: 3000, // Auto-refresh every 3 seconds
  });

  const clearHistoryMutation = useMutation({
    mutationFn: async (type?: string) => {
      const url = type ? `/api/history?type=${type}` : '/api/history';
      const res = await apiRequest('DELETE', url);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] });
      toast({ title: 'History cleared', description: 'Search history has been deleted.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to clear history.', variant: 'destructive' });
    }
  });

  const handleRerun = (item: HistoryItem) => {
    if (item.type === 'medicine') {
      setLocation(`/medicine-search?q=${encodeURIComponent(item.query)}`);
    } else if (item.type === 'bioactivity') {
      setLocation(`/analyze?input=${encodeURIComponent(item.query)}`);
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) {
      return date.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }) + ' (Today)';
    }
    
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const filterByDate = (items: HistoryItem[]) => {
    if (dateFilter === 'all') return items;
    
    const now = new Date();
    const filterDate = new Date();
    
    switch (dateFilter) {
      case 'today':
        filterDate.setHours(0, 0, 0, 0);
        break;
      case '7days':
        filterDate.setDate(now.getDate() - 7);
        break;
      case '30days':
        filterDate.setDate(now.getDate() - 30);
        break;
      default:
        return items;
    }
    
    return items.filter(item => {
      if (!item.createdAt) return false;
      const itemDate = new Date(item.createdAt);
      return itemDate >= filterDate;
    });
  };

  const items: HistoryItem[] = data?.items || [];
  const filteredItems = filterByDate(items);
  const medicine = filteredItems.filter(i => i.type === 'medicine');
  const bioactivity = filteredItems.filter(i => i.type === 'bioactivity');

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Clock className="h-10 w-10 text-primary" />
              Search & Prediction History
            </h1>
            <p className="text-muted-foreground">Recent medicine searches and bioactivity prediction events. Click any entry to re-run.</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => clearHistoryMutation.mutate(undefined)}
              disabled={clearHistoryMutation.isPending || items.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Pill className="w-5 h-5" /> Medicine Searches
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => clearHistoryMutation.mutate('medicine')}
                disabled={clearHistoryMutation.isPending || medicine.length === 0}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : medicine.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent medicine searches.</p>
            ) : (
              <ul className="space-y-2 max-h-[600px] overflow-y-auto">
                {medicine.map(item => (
                  <li 
                    key={item.id} 
                    className="p-3 rounded-lg border hover:border-primary transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate" title={item.query}>{item.query}</span>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {item.resultCount} {item.resultCount === 1 ? 'result' : 'results'}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-1">
                          {(item.details?.sample || []).slice(0, 2).map((s: any) => (
                            <span key={s.id} className="font-mono bg-muted px-1.5 py-0.5 rounded">
                              {s.name}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDateTime(item.createdAt)}
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-6 text-xs"
                            onClick={() => handleRerun(item)}
                          >
                            <Search className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5" /> Bioactivity Predictions
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => clearHistoryMutation.mutate('bioactivity')}
                disabled={clearHistoryMutation.isPending || bioactivity.length === 0}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : bioactivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent predictions.</p>
            ) : (
              <ul className="space-y-2 max-h-[600px] overflow-y-auto">
                {bioactivity.map(item => (
                  <li 
                    key={item.id} 
                    className="p-3 rounded-lg border hover:border-primary transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate" title={item.query}>{item.query}</span>
                          {item.details?.overallRisk && (
                            <Badge 
                              className="text-xs shrink-0"
                              variant={
                                item.details.overallRisk === 'LOW' ? 'default' : 
                                item.details.overallRisk === 'MEDIUM' ? 'secondary' : 
                                'destructive'
                              }
                            >
                              {item.details.overallRisk} Risk
                            </Badge>
                          )}
                        </div>
                        {item.details && (
                          <div className="text-xs text-muted-foreground flex gap-3 mt-1">
                            {item.details.pic50 !== undefined && (
                              <span className="font-mono">pIC50: {item.details.pic50.toFixed(2)}</span>
                            )}
                            {item.details.confidence !== undefined && (
                              <span>Conf: {(item.details.confidence * 100).toFixed(1)}%</span>
                            )}
                            {item.details.overallScore !== undefined && (
                              <span>Score: {item.details.overallScore}/10</span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDateTime(item.createdAt)}
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-6 text-xs"
                            onClick={() => handleRerun(item)}
                          >
                            <FlaskConical className="h-3 w-3 mr-1" />
                            Analyze
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
