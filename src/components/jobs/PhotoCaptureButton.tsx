import { useRef, useState } from "react";
import { Camera, ChevronDown, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useUploadPhoto } from "@/hooks/useUploadPhoto";
import { useToast } from "@/hooks/use-toast";
import type { MediaCategory } from "@/hooks/useJobMedia";

interface PhotoCaptureButtonProps {
  jobId: string;
  pendingCount?: number;
  variant?: "default" | "floating";
  onUploadStart?: () => void;
  onUploadComplete?: () => void;
}

const CATEGORIES: { value: MediaCategory; label: string }[] = [
  { value: "before", label: "Before" },
  { value: "during", label: "During" },
  { value: "after", label: "After" },
  { value: "damage", label: "Damage" },
  { value: "equipment", label: "Equipment" },
  { value: "materials", label: "Materials" },
  { value: "general", label: "General" },
];

export function PhotoCaptureButton({
  jobId,
  pendingCount = 0,
  variant = "default",
  onUploadStart,
  onUploadComplete,
}: PhotoCaptureButtonProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<MediaCategory>("general");
  const uploadPhoto = useUploadPhoto();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    onUploadStart?.();

    for (const file of Array.from(files)) {
      try {
        await uploadPhoto.mutateAsync({
          file,
          jobId,
          category: selectedCategory,
        });
      } catch (error) {
        console.error("Upload failed:", error);
        toast({
          title: "Upload failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    }

    onUploadComplete?.();
    
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCategorySelect = (category: MediaCategory) => {
    setSelectedCategory(category);
    fileInputRef.current?.click();
  };

  if (variant === "floating") {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="lg"
              className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
            >
              <Camera className="h-6 w-6" />
              {pendingCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full px-1 text-xs"
                >
                  {pendingCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {CATEGORIES.map((cat) => (
              <DropdownMenuItem
                key={cat.value}
                onClick={() => handleCategorySelect(cat.value)}
              >
                {cat.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <ImagePlus className="h-4 w-4" />
            Add Photo
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingCount}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {CATEGORIES.map((cat) => (
            <DropdownMenuItem
              key={cat.value}
              onClick={() => handleCategorySelect(cat.value)}
            >
              {cat.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
