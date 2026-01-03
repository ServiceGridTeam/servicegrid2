import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { Tables } from "@/integrations/supabase/types";

type QuoteData = Tables<"quotes"> & {
  customer: Pick<Tables<"customers">, "first_name" | "last_name" | "email" | "phone"> | null;
  business: Pick<Tables<"businesses">, "id" | "name" | "phone" | "email" | "logo_url" | "address_line1" | "city" | "state" | "zip"> | null;
  quote_items: Tables<"quote_items">[];
};

interface QuotePDFProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: QuoteData;
}

export function QuotePDF({ open, onOpenChange, quote }: QuotePDFProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!contentRef.current) return;

    const canvas = await html2canvas(contentRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    pdf.save(`${quote.quote_number}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  const business = quote.business;
  const customer = quote.customer;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Quote Preview</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button size="sm" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* PDF Content */}
        <div
          ref={contentRef}
          className="bg-white text-black p-8 rounded-lg"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-200">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{business?.name}</h1>
              {business?.address_line1 && (
                <p className="text-gray-600 mt-1">{business.address_line1}</p>
              )}
              {business?.city && (
                <p className="text-gray-600">
                  {business.city}, {business.state} {business.zip}
                </p>
              )}
              {business?.phone && <p className="text-gray-600">{business.phone}</p>}
              {business?.email && <p className="text-gray-600">{business.email}</p>}
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-gray-700">QUOTE</h2>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {quote.quote_number}
              </p>
              <p className="text-gray-600 mt-2">
                Date: {format(new Date(quote.created_at), "MMMM d, yyyy")}
              </p>
              {quote.valid_until && (
                <p className="text-gray-600">
                  Valid Until: {format(new Date(quote.valid_until), "MMMM d, yyyy")}
                </p>
              )}
            </div>
          </div>

          {/* Customer Info */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
              Prepared For
            </h3>
            <p className="text-lg font-semibold text-gray-900">
              {customer?.first_name} {customer?.last_name}
            </p>
            {customer?.email && <p className="text-gray-600">{customer.email}</p>}
            {customer?.phone && <p className="text-gray-600">{customer.phone}</p>}
          </div>

          {/* Title */}
          {quote.title && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900">{quote.title}</h3>
            </div>
          )}

          {/* Line Items Table */}
          <table className="w-full mb-6">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-3 text-gray-700 font-semibold">Description</th>
                <th className="text-right py-3 text-gray-700 font-semibold w-20">Qty</th>
                <th className="text-right py-3 text-gray-700 font-semibold w-28">Price</th>
                <th className="text-right py-3 text-gray-700 font-semibold w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.quote_items.map((item, idx) => (
                <tr key={item.id} className={idx % 2 === 0 ? "bg-gray-50" : ""}>
                  <td className="py-3 px-2 text-gray-800">{item.description}</td>
                  <td className="py-3 px-2 text-right text-gray-800">{item.quantity}</td>
                  <td className="py-3 px-2 text-right text-gray-800">
                    ${Number(item.unit_price).toFixed(2)}
                  </td>
                  <td className="py-3 px-2 text-right text-gray-800 font-medium">
                    ${Number(item.total).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64">
              <div className="flex justify-between py-2 text-gray-700">
                <span>Subtotal</span>
                <span>${Number(quote.subtotal).toFixed(2)}</span>
              </div>
              {Number(quote.discount_amount) > 0 && (
                <div className="flex justify-between py-2 text-green-600">
                  <span>Discount</span>
                  <span>-${Number(quote.discount_amount).toFixed(2)}</span>
                </div>
              )}
              {Number(quote.tax_rate) > 0 && (
                <div className="flex justify-between py-2 text-gray-700">
                  <span>Tax ({Number(quote.tax_rate)}%)</span>
                  <span>${Number(quote.tax_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between py-3 border-t-2 border-gray-300 text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>${Number(quote.total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
                Notes
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}

          {/* Signature */}
          {quote.status === "approved" && quote.signature_url && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
                Approved By
              </h3>
              <div className="flex items-end gap-4">
                <img
                  src={quote.signature_url}
                  alt="Signature"
                  className="h-12"
                />
                <div>
                  <p className="font-medium text-gray-900">{quote.approved_by}</p>
                  {quote.approved_at && (
                    <p className="text-sm text-gray-600">
                      {format(new Date(quote.approved_at), "MMMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
            <p>Thank you for your business!</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
