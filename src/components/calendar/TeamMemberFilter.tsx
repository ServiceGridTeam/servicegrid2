import { useState } from "react";
import { Check, ChevronsUpDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTeamMembers } from "@/hooks/useJobs";
import { cn } from "@/lib/utils";

interface TeamMemberFilterProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function TeamMemberFilter({ selectedIds, onChange }: TeamMemberFilterProps) {
  const [open, setOpen] = useState(false);
  const { data: teamMembers = [] } = useTeamMembers();

  const toggleMember = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    onChange(teamMembers.map((m) => m.id));
  };

  const clearAll = () => {
    onChange([]);
  };

  const getInitials = (firstName: string | null, lastName: string | null) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "?";
  };

  const selectedMembers = teamMembers.filter((m) => selectedIds.includes(m.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          <div className="flex items-center gap-2 truncate">
            <Users className="h-4 w-4 shrink-0" />
            {selectedIds.length === 0 ? (
              <span>All Team Members</span>
            ) : selectedIds.length === 1 ? (
              <span className="truncate">
                {selectedMembers[0]?.first_name} {selectedMembers[0]?.last_name}
              </span>
            ) : (
              <span>{selectedIds.length} selected</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search team members..." />
          <CommandList>
            <CommandEmpty>No team members found.</CommandEmpty>
            <CommandGroup>
              <div className="flex items-center gap-2 px-2 py-1.5 border-b">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={selectAll}
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={clearAll}
                >
                  Clear
                </Button>
              </div>
              {teamMembers.map((member) => (
                <CommandItem
                  key={member.id}
                  value={`${member.first_name} ${member.last_name} ${member.email}`}
                  onSelect={() => toggleMember(member.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedIds.includes(member.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <Avatar className="h-6 w-6 mr-2">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(member.first_name, member.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">
                    {member.first_name} {member.last_name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
