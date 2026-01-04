import { useState } from "react";
import { Check, ChevronsUpDown, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { useTeamMembers } from "@/hooks/useJobs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface MultiAssigneeSelectorProps {
  value: string[];
  onValueChange: (userIds: string[]) => void;
}

export function MultiAssigneeSelector({ value, onValueChange }: MultiAssigneeSelectorProps) {
  const [open, setOpen] = useState(false);
  const { data: teamMembers = [], isLoading } = useTeamMembers();

  const selectedMembers = teamMembers.filter((m) => value.includes(m.id));

  const toggleMember = (memberId: string) => {
    if (value.includes(memberId)) {
      onValueChange(value.filter((id) => id !== memberId));
    } else {
      onValueChange([...value, memberId]);
    }
  };

  const removeMember = (memberId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange(value.filter((id) => id !== memberId));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between min-h-10"
          >
            {selectedMembers.length > 0 ? (
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                {selectedMembers.length} team member{selectedMembers.length > 1 ? "s" : ""} assigned
              </span>
            ) : (
              <span className="text-muted-foreground">
                {isLoading ? "Loading..." : "Assign team members"}
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search team members..." />
            <CommandList>
              <CommandEmpty>No team members found.</CommandEmpty>
              <CommandGroup>
                {teamMembers.map((member) => {
                  const isSelected = value.includes(member.id);
                  const isLead = value.indexOf(member.id) === 0;
                  
                  return (
                    <CommandItem
                      key={member.id}
                      value={`${member.first_name} ${member.last_name}`}
                      onSelect={() => toggleMember(member.id)}
                    >
                      <Avatar className="mr-2 h-6 w-6">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {member.first_name?.[0]}
                          {member.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col flex-1">
                        <span className="flex items-center gap-2">
                          {member.first_name} {member.last_name}
                          {isLead && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">
                              Lead
                            </Badge>
                          )}
                        </span>
                        {member.email && (
                          <span className="text-xs text-muted-foreground">
                            {member.email}
                          </span>
                        )}
                      </div>
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected members as badges */}
      {selectedMembers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedMembers.map((member, index) => (
            <Badge
              key={member.id}
              variant={index === 0 ? "default" : "secondary"}
              className="flex items-center gap-1 pr-1"
            >
              <Avatar className="h-4 w-4">
                <AvatarImage src={member.avatar_url || undefined} />
                <AvatarFallback className="text-[8px]">
                  {member.first_name?.[0]}{member.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-24 truncate">
                {member.first_name} {member.last_name?.[0]}.
              </span>
              {index === 0 && <span className="text-[10px] opacity-75">(Lead)</span>}
              <button
                type="button"
                onClick={(e) => removeMember(member.id, e)}
                className="ml-0.5 rounded-full hover:bg-background/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
