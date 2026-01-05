import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-foreground mb-2">ServiceGrid</h1>
          <p className="text-muted-foreground">Terms of Service</p>
        </div>

        {/* Content */}
        <div className="bg-card rounded-lg border p-8 space-y-8">
          <div className="text-sm text-muted-foreground">
            Last updated: January 5, 2026
          </div>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using ServiceGrid ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              ServiceGrid is a field service management platform that helps businesses manage customers, create quotes and invoices, schedule jobs, manage team members, and optimize routes. The Service is provided on a subscription basis.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">3. User Accounts</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>To use the Service, you must create an account and provide accurate, complete information. You are responsible for:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized access</li>
                <li>Ensuring your team members comply with these terms</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">4. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree not to use the Service to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-2">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on the rights of others</li>
              <li>Transmit malicious code or interfere with the Service</li>
              <li>Attempt to gain unauthorized access to the Service or its systems</li>
              <li>Use the Service for any fraudulent or deceptive purposes</li>
              <li>Resell or redistribute the Service without authorization</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">5. Payment Terms</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>If you subscribe to a paid plan:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>Fees are billed in advance on a monthly or annual basis</li>
                <li>All fees are non-refundable except as required by law</li>
                <li>We may change pricing with 30 days notice</li>
                <li>Failure to pay may result in suspension or termination of your account</li>
              </ul>
              <p>Payment processing is handled by Stripe. By using our payment features, you also agree to Stripe's terms of service.</p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">6. Your Data</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>You retain ownership of all data you enter into the Service. By using the Service, you grant us a limited license to use, store, and process your data solely to provide the Service to you.</p>
              <p>You are responsible for the accuracy and legality of the data you upload, including customer information, and for obtaining any necessary consents from your customers.</p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">7. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service, including its design, features, and content, is owned by ServiceGrid and protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works without our express permission.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">8. Disclaimers</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.</p>
              <p>Route optimization and scheduling features are provided as suggestions only. You are responsible for verifying the accuracy and appropriateness of any routes or schedules.</p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">9. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, SERVICEGRID SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">10. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may suspend or terminate your access to the Service at any time for violation of these terms or for any other reason with notice. Upon termination, your right to use the Service will immediately cease. You may export your data before termination.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">11. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may modify these terms at any time. We will notify you of material changes by email or through the Service. Continued use of the Service after changes take effect constitutes acceptance of the new terms.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">12. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles. Any disputes shall be resolved through binding arbitration or in the courts of competent jurisdiction.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">13. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at team@servicegrid.app.
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
              to="/privacy" 
              className="text-sm text-primary hover:underline"
            >
              View Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
