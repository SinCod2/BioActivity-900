import { useState } from "react";
import { Link } from "wouter";
import { 
  ArrowRight, 
  FlaskConical, 
  Shield, 
  BarChart3, 
  Zap, 
  CheckCircle, 
  Sparkles,
  Microscope,
  Activity,
  Brain
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Welcome() {
  const features = [
    {
      icon: FlaskConical,
      title: "Bioactivity Prediction",
      description: "ML-powered pIC50 prediction for compound bioactivity with confidence scoring",
      color: "from-blue-500 to-cyan-500",
    },
    {
      icon: Shield,
      title: "Safety Assessment",
      description: "Comprehensive toxicity evaluation: hepatotoxicity, cardiotoxicity, mutagenicity, and hERG",
      color: "from-green-500 to-emerald-500",
    },
    {
      icon: BarChart3,
      title: "Drug-likeness Analysis",
      description: "Lipinski's Rule compliance, molecular descriptors, and pharmacokinetic properties",
      color: "from-purple-500 to-pink-500",
    },
    {
      icon: Brain,
      title: "AI-Powered Insights",
      description: "Advanced models trained on extensive bioactivity and toxicity databases",
      color: "from-orange-500 to-red-500",
    },
  ];

  const stats = [
    { label: "Compounds Analyzed", value: "10,000+", icon: Microscope },
    { label: "Accuracy Rate", value: "94.5%", icon: CheckCircle },
    { label: "ML Models", value: "12+", icon: Brain },
    { label: "Response Time", value: "<2s", icon: Zap },
  ];

  const steps = [
    {
      number: "1",
      title: "Input Compound",
      description: "Enter a SMILES string, compound name, or upload a structure file",
    },
    {
      number: "2",
      title: "AI Analysis",
      description: "Our ML models evaluate molecular properties and safety profiles",
    },
    {
      number: "3",
      title: "Get Results",
      description: "View detailed predictions, 3D structures, and export reports",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-20 pb-16">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI-Powered Safety Prediction</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Predict Compound
            <span className="block bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Bioactivity & Safety
            </span>
          </h1>

          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            AI-powered platform for comprehensive compound bioactivity prediction and
            safety assessment. Analyze molecular properties, predict toxicity, and evaluate
            drug-likeness in seconds.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center">
            <Link href="/analyze" className="w-full sm:w-auto">
              <Button size="lg" className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 shadow-lg hover:shadow-xl transition-all w-full">
                Start Analyzing
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
            {stats.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <Card key={idx} className="border-border/50 hover:border-primary/50 transition-all hover:shadow-md">
                  <CardContent className="pt-6 text-center">
                    <Icon className="w-8 h-8 mx-auto mb-2 text-primary" />
                    <div className="text-3xl font-bold mb-1">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Powerful Features</h2>
          <p className="text-lg text-muted-foreground">
            Everything you need for comprehensive molecular analysis
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <Card
                key={idx}
                className="border-2 border-border/50 hover:border-primary/50 transition-all hover:shadow-lg group"
              >
                <CardContent className="pt-6">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${feature.color} p-3 mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-full h-full text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-lg text-muted-foreground">
            Get started in three simple steps
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Connection Line */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-pink-500 -translate-y-1/2 -z-10"></div>

            <div className="grid md:grid-cols-3 gap-8">
              {steps.map((step, idx) => (
                <div key={idx} className="relative">
                  <Card className="border-2 border-primary/20 hover:border-primary/50 transition-all hover:shadow-lg">
                    <CardContent className="pt-6 text-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-primary to-purple-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4 shadow-lg">
                        {step.number}
                      </div>
                      <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center mt-16">
          <Card className="max-w-2xl mx-auto border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5">
            <CardContent className="pt-8 pb-8">
              <h3 className="text-2xl font-bold mb-3">Ready to Get Started?</h3>
              <p className="text-muted-foreground mb-6">
                Join researchers and scientists using BioPredict for molecular safety analysis
              </p>
              <Link href="/analyze">
                <Button size="lg" className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90">
                  Launch Platform
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
