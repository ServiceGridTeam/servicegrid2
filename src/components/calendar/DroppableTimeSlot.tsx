import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface DroppableTimeSlotProps {
  id: string;
  day: Date;
  hour: number;
  minute?: number;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

export function DroppableTimeSlot({
  id,
  day,
  hour,
  minute = 0,
  className,
  children,
  onClick,
}: DroppableTimeSlotProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { day, hour, minute, type: "timeslot" },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "transition-colors",
        isOver && "bg-primary/20",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
