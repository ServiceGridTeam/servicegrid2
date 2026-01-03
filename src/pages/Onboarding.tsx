import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useSetupBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wrench, ArrowRight, Building2, User } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const industries = [
  { value: "landscaping", label: "Landscaping & Lawn Care" },
  { value: "cleaning", label: "Cleaning Services" },
  { value: "hvac", label: "HVAC" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "pest_control", label: "Pest Control" },
  { value: "roofing", label: "Roofing" },
  { value: "painting", label: "Painting" },
  { value: "pool_service", label: "Pool Service" },
  { value: "appliance_repair", label: "Appliance Repair" },
  { value: "other", label: "Other" },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: Profile data
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");

  // Step 2: Business data
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const setupBusiness = useSetupBusiness();

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast({
        variant: "destructive",
        title: "Required fields missing",
        description: "Please enter your first and last name.",
      });
      return;
    }

    await updateProfile.mutateAsync({
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      job_title: jobTitle || null,
    });

    setStep(2);
  };

  const handleBusinessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      toast({
        variant: "destructive",
        title: "Required field missing",
        description: "Please enter your business name.",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Call atomic backend function - does all 3 operations in one transaction
      await setupBusiness.mutateAsync({
        name: businessName,
        industry: industry || undefined,
        phone: businessPhone || undefined,
        email: businessEmail || user?.email || undefined,
      });

      toast({
        title: "Welcome to ServiceGrid!",
        description: "Your account is all set up. Let's get started.",
      });

      navigate("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Setup failed",
        description: error.message || "Something went wrong. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Pre-fill profile data if available
  useState(() => {
    if (profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setPhone(profile.phone || "");
      setJobTitle(profile.job_title || "");
    }
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-lg space-y-6 animate-fade-in">
        {/* Logo/Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary text-primary-foreground mb-2">
            <Wrench className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome to ServiceGrid</h1>
          <p className="text-muted-foreground text-sm">
            Let's set up your account in just 2 simple steps
          </p>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className={step >= 1 ? "text-primary font-medium" : "text-muted-foreground"}>
              1. Your Profile
            </span>
            <span className={step >= 2 ? "text-primary font-medium" : "text-muted-foreground"}>
              2. Your Business
            </span>
          </div>
          <Progress value={step === 1 ? 50 : 100} className="h-2" />
        </div>

        <Card className="border-border/50 shadow-lg">
          {step === 1 ? (
            <>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Tell us about yourself</CardTitle>
                    <CardDescription>
                      This helps personalize your experience
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first-name">First name *</Label>
                      <Input
                        id="first-name"
                        placeholder="John"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last-name">Last name *</Label>
                      <Input
                        id="last-name"
                        placeholder="Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="job-title">Your role / job title</Label>
                    <Input
                      id="job-title"
                      placeholder="Owner, Manager, Technician..."
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={updateProfile.isPending}
                  >
                    {updateProfile.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Set up your business</CardTitle>
                    <CardDescription>
                      We'll create your workspace based on this info
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBusinessSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="business-name">Business name *</Label>
                    <Input
                      id="business-name"
                      placeholder="Acme Services LLC"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger id="industry">
                        <SelectValue placeholder="Select your industry" />
                      </SelectTrigger>
                      <SelectContent>
                        {industries.map((ind) => (
                          <SelectItem key={ind.value} value={ind.value}>
                            {ind.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="business-phone">Business phone</Label>
                      <Input
                        id="business-phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={businessPhone}
                        onChange={(e) => setBusinessPhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="business-email">Business email</Label>
                      <Input
                        id="business-email"
                        type="email"
                        placeholder="info@example.com"
                        value={businessEmail}
                        onChange={(e) => setBusinessEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                      disabled={isLoading}
                    >
                      Back
                    </Button>
                    <Button type="submit" className="flex-1" disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Complete Setup
                    </Button>
                  </div>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}