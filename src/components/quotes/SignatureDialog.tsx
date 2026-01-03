import { useState, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eraser } from "lucide-react";

interface SignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: { signature: string; name: string }) => void;
  isLoading?: boolean;
}

export function SignatureDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: SignatureDialogProps) {
  const [name, setName] = useState("");
  const sigCanvasRef = useRef<SignatureCanvas>(null);

  const handleClear = () => {
    sigCanvasRef.current?.clear();
  };

  const handleConfirm = () => {
    if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
      return;
    }

    const signatureData = sigCanvasRef.current.toDataURL("image/png");
    onConfirm({ signature: signatureData, name: name.trim() });
  };

  const isValid = name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve Quote</DialogTitle>
          <DialogDescription>
            Please sign below to approve this quote and agree to the terms.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your Full Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Signature</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
              >
                <Eraser className="mr-1 h-3 w-3" />
                Clear
              </Button>
            </div>
            <div className="border rounded-md bg-background">
              <SignatureCanvas
                ref={sigCanvasRef}
                canvasProps={{
                  className: "w-full h-32 cursor-crosshair",
                  style: { width: "100%", height: "128px" },
                }}
                backgroundColor="transparent"
                penColor="#000"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Draw your signature above using mouse or touch
            </p>
          </div>

          <p className="text-xs text-muted-foreground border-t pt-3">
            By signing, you confirm that you have reviewed and agree to the quote
            terms, pricing, and conditions as stated.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || isLoading}>
            {isLoading ? "Approving..." : "Confirm Approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
