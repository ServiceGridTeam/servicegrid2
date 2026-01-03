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

type InvoiceData = Tables<"invoices"> & {
  customer: Pick<Tables<"customers">, "first_name" | "last_name" | "email" | "phone"> | null;
  business: Pick<Tables<"businesses">, "id" | "name" | "phone" | "email" | "logo_url" | "address_line1" | "city" | "state" | "zip"> | null;
  invoice_items: Tables<"invoice_items">[];
};

interface InvoicePDFProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceData;
}

export function InvoicePDF({ open, onOpenChange, invoice }: InvoicePDFProps) {
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
    pdf.save(`${invoice.invoice_number}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  const business = invoice.business;
  const customer = invoice.customer;
  const isPaid = invoice.status === "paid";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Invoice Preview</span>
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
              <h2 className="text-2xl font-bold text-gray-700">INVOICE</h2>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {invoice.invoice_number}
              </p>
              <p className="text-gray-600 mt-2">
                Date: {format(new Date(invoice.created_at), "MMMM d, yyyy")}
              </p>
              {invoice.due_date && (
                <p className="text-gray-600">
                  Due: {format(new Date(invoice.due_date), "MMMM d, yyyy")}
                </p>
              )}
              {isPaid && (
                <div className="mt-3 inline-block px-4 py-1 bg-green-100 text-green-700 rounded-full font-semibold">
                  PAID
                </div>
              )}
            </div>
          </div>

          {/* Customer Info */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
              Bill To
            </h3>
            <p className="text-lg font-semibold text-gray-900">
              {customer?.first_name} {customer?.last_name}
            </p>
            {customer?.email && <p className="text-gray-600">{customer.email}</p>}
            {customer?.phone && <p className="text-gray-600">{customer.phone}</p>}
          </div>

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
              {invoice.invoice_items.map((item, idx) => (
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
                <span>${Number(invoice.subtotal).toFixed(2)}</span>
              </div>
              {Number(invoice.discount_amount) > 0 && (
                <div className="flex justify-between py-2 text-green-600">
                  <span>Discount</span>
                  <span>-${Number(invoice.discount_amount).toFixed(2)}</span>
                </div>
              )}
              {Number(invoice.tax_rate) > 0 && (
                <div className="flex justify-between py-2 text-gray-700">
                  <span>Tax ({Number(invoice.tax_rate)}%)</span>
                  <span>${Number(invoice.tax_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between py-3 border-t-2 border-gray-300 text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>${Number(invoice.total).toFixed(2)}</span>
              </div>
              {Number(invoice.amount_paid) > 0 && (
                <div className="flex justify-between py-2 text-green-600">
                  <span>Paid</span>
                  <span>-${Number(invoice.amount_paid).toFixed(2)}</span>
                </div>
              )}
              {Number(invoice.balance_due) > 0 && (
                <div className="flex justify-between py-2 text-lg font-bold text-gray-900 border-t border-gray-200">
                  <span>Balance Due</span>
                  <span>${Number(invoice.balance_due).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
                Notes
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
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
