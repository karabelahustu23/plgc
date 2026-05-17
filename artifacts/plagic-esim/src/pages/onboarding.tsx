import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function Onboarding() {
  const { user, profile, refreshProfile } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [frequency, setFrequency] = useState("");

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName) return;
    
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, {
        displayName: `${firstName} ${lastName}`
      });
    }
    setStep(2);
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!frequency || !user) return;

    await updateDoc(doc(db, "users", user.uid), {
      onboardingCompleted: true,
      travelFrequency: frequency
    });
    
    await refreshProfile();
    setLocation("/");
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-3xl font-bold text-primary">Plagic eSIM</h1>
          <p className="text-muted-foreground">Just a few quick questions to get started.</p>
        </div>

        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-6">
            <h2 className="text-xl font-medium">Nice to meet you! Tell us about yourself</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input 
                  id="firstName" 
                  value={firstName} 
                  onChange={(e) => setFirstName(e.target.value)} 
                  required 
                  autoFocus 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input 
                  id="lastName" 
                  value={lastName} 
                  onChange={(e) => setLastName(e.target.value)} 
                  required 
                />
              </div>
            </div>
            <Button type="submit" className="w-full">Continue</Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleComplete} className="space-y-6">
            <h2 className="text-xl font-medium">How often do you travel?</h2>
            <RadioGroup value={frequency} onValueChange={setFrequency} className="space-y-3">
              <div className="flex items-center space-x-3 space-y-0 rounded-lg border p-4 hover:bg-secondary/50 cursor-pointer">
                <RadioGroupItem value="always" id="always" />
                <Label htmlFor="always" className="flex-1 cursor-pointer">I'm always traveling</Label>
              </div>
              <div className="flex items-center space-x-3 space-y-0 rounded-lg border p-4 hover:bg-secondary/50 cursor-pointer">
                <RadioGroupItem value="few_times" id="few_times" />
                <Label htmlFor="few_times" className="flex-1 cursor-pointer">A few times a year</Label>
              </div>
              <div className="flex items-center space-x-3 space-y-0 rounded-lg border p-4 hover:bg-secondary/50 cursor-pointer">
                <RadioGroupItem value="occasionally" id="occasionally" />
                <Label htmlFor="occasionally" className="flex-1 cursor-pointer">Occasionally</Label>
              </div>
              <div className="flex items-center space-x-3 space-y-0 rounded-lg border p-4 hover:bg-secondary/50 cursor-pointer">
                <RadioGroupItem value="getting_started" id="getting_started" />
                <Label htmlFor="getting_started" className="flex-1 cursor-pointer">Just getting started</Label>
              </div>
            </RadioGroup>
            <div className="flex gap-4">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button type="submit" disabled={!frequency} className="flex-1">Complete</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
