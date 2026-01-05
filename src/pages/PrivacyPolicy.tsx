import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-foreground mb-2">ServiceGrid</h1>
          <p className="text-muted-foreground">Privacy Policy</p>
        </div>

        {/* Content */}
        <div className="bg-card rounded-lg border p-8 space-y-8">
          <div className="text-sm text-muted-foreground">
            Last updated: January 5, 2026
          </div>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              ServiceGrid ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our field service management platform.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">2. Information We Collect</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p><strong className="text-foreground">Personal Information:</strong> Name, email address, phone number, and billing information when you create an account or subscribe to our services.</p>
              <p><strong className="text-foreground">Business Information:</strong> Company name, address, team member details, customer information, job details, quotes, and invoices that you enter into the platform.</p>
              <p><strong className="text-foreground">Usage Data:</strong> Information about how you interact with our platform, including pages visited, features used, and time spent on the platform.</p>
              <p><strong className="text-foreground">Location Data:</strong> With your consent, we may collect location data to enable route optimization and job tracking features.</p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-2">
              <li>To provide and maintain our field service management platform</li>
              <li>To process payments and manage your subscription</li>
              <li>To send quotes and invoices to your customers on your behalf</li>
              <li>To optimize routes and scheduling for your jobs</li>
              <li>To communicate with you about your account and our services</li>
              <li>To improve our platform and develop new features</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">4. Third-Party Services</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>We use the following third-party services to provide our platform:</p>
              <p><strong className="text-foreground">Stripe:</strong> For payment processing. Stripe's privacy policy governs the handling of payment information.</p>
              <p><strong className="text-foreground">Google Maps:</strong> For geocoding addresses and optimizing routes. Google's privacy policy applies to this data.</p>
              <p>We only share the minimum information necessary with these providers to deliver our services.</p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">5. Data Storage and Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data is stored securely using industry-standard encryption and security practices. We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your information for as long as your account is active or as needed to provide you services. If you request deletion of your account, we will delete your personal information within 30 days, except where we are required to retain it for legal or legitimate business purposes.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              Depending on your location, you may have the following rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-2">
              <li>Access and receive a copy of your data</li>
              <li>Correct inaccurate or incomplete information</li>
              <li>Request deletion of your personal data</li>
              <li>Object to or restrict certain processing</li>
              <li>Data portability</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">8. Cookies and Tracking</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use essential cookies to maintain your session and preferences. We do not use tracking cookies for advertising purposes. You can control cookie settings through your browser preferences.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">9. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our platform is not intended for children under 16 years of age. We do not knowingly collect personal information from children under 16.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">10. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">11. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at support@servicegrid.app.
            </p>
          </section>

          {/* Navigation */}
          <div className="pt-6 border-t flex flex-col sm:flex-row justify-between gap-4">
            <Link 
              to="/auth" 
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </Link>
            <Link 
              to="/terms" 
              className="text-sm text-primary hover:underline"
            >
              View Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
