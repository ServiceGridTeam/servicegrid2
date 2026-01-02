import { Check, ChevronsUpDown, User } from "lucide-react";
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
import { useState } from "react";
import { useTeamMembers } from "@/hooks/useJobs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AssigneeSelectorProps {
  value?: string;
  onValueChange: (userId: string | undefined) => void;
}

export function AssigneeSelector({ value, onValueChange }: AssigneeSelectorProps) {
  const [open, setOpen] = useState(false);
  const { data: teamMembers = [], isLoading } = useTeamMembers();

  const selectedMember = teamMembers.find((m) => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedMember ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={selectedMember.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {selectedMember.first_name?.[0]}
                  {selectedMember.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <span>
                {selectedMember.first_name} {selectedMember.last_name}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">
              {isLoading ? "Loading..." : "Unassigned"}
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
              <CommandItem
                value="unassigned"
                onSelect={() => {
                  onValueChange(undefined);
                  setOpen(false);
                }}
              >
                <User className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Unassigned</span>
                <Check
                  className={cn(
                    "ml-auto h-4 w-4",
                    !value ? "opacity-100" : "opacity-0"
                  )}
                />
              </CommandItem>
              {teamMembers.map((member) => (
                <CommandItem
                  key={member.id}
                  value={`${member.first_name} ${member.last_name}`}
                  onSelect={() => {
                    onValueChange(member.id);
                    setOpen(false);
                  }}
                >
                  <Avatar className="mr-2 h-5 w-5">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {member.first_name?.[0]}
                      {member.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span>
                      {member.first_name} {member.last_name}
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
                      value === member.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
