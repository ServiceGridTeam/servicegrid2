/**
 * ReassignWorkerDropdown component
 * Allows managers to assign/reassign customer threads to team members
 */

import { useState } from 'react';
import { Check, ChevronsUpDown, UserCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTeamMembers } from '@/hooks/useTeamManagement';
import { cn } from '@/lib/utils';

interface ReassignWorkerDropdownProps {
  conversationId: string;
  assignedWorkerId: string | null;
  assignedWorker?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url?: string | null;
  } | null;
  onAssign: (conversationId: string, workerId: string | null) => void;
  className?: string;
}

export function ReassignWorkerDropdown({
  conversationId,
  assignedWorkerId,
  assignedWorker,
  onAssign,
  className,
}: ReassignWorkerDropdownProps) {
  const [open, setOpen] = useState(false);
  const { data: teamMembers = [], isLoading } = useTeamMembers();

  const getInitials = (firstName: string | null, lastName: string | null) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
  };

  const handleSelect = (workerId: string) => {
    const newWorkerId = workerId === assignedWorkerId ? null : workerId;
    onAssign(conversationId, newWorkerId);
    setOpen(false);
  };

  const handleUnassign = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAssign(conversationId, null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between gap-2 h-8 text-xs', className)}
        >
          {assignedWorker ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={assignedWorker.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">
                  {getInitials(assignedWorker.first_name, assignedWorker.last_name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate max-w-[100px]">
                {assignedWorker.first_name} {assignedWorker.last_name?.[0]}.
              </span>
              <button
                onClick={handleUnassign}
                className="ml-1 hover:bg-muted rounded p-0.5"
                aria-label="Unassign"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserCircle className="h-4 w-4" />
              <span>Unassigned</span>
            </div>
          )}
          <ChevronsUpDown className="h-3 w-3 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search team..." className="h-9" />
          <CommandList>
            <CommandEmpty>
              {isLoading ? 'Loading...' : 'No team members found.'}
            </CommandEmpty>
            <CommandGroup>
              {teamMembers.map((member) => {
                const isSelected = member.id === assignedWorkerId;
                return (
                  <CommandItem
                    key={member.id}
                    value={`${member.first_name} ${member.last_name} ${member.email}`}
                    onSelect={() => handleSelect(member.id)}
                    className="flex items-center gap-2"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {getInitials(member.first_name, member.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">
                        {member.first_name} {member.last_name}
                      </p>
                      {member.job_title && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {member.job_title}
                        </p>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
