/**
 * NewChatDialog - Dialog for creating new conversations
 */

import { useState, useMemo } from 'react';
import { Loader2, Users, Briefcase, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useConversations, ConversationWithDetails, ConversationType } from '@/hooks/useConversations';
import { useJobs } from '@/hooks/useJobs';
import { useTeamMembers } from '@/hooks/useTeamManagement';

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (conversation: ConversationWithDetails) => void;
}

type ChatType = 'team_chat' | 'job_discussion';

export function NewChatDialog({ open, onOpenChange, onCreated }: NewChatDialogProps) {
  const [chatType, setChatType] = useState<ChatType>('team_chat');
  const [title, setTitle] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  const { createConversation, isCreating } = useConversations();
  const { data: jobs = [], isLoading: jobsLoading } = useJobs();
  const { data: teamMembers = [], isLoading: membersLoading } = useTeamMembers();

  // Filter to active jobs
  const activeJobs = useMemo(() => 
    jobs.filter(job => ['scheduled', 'in_progress'].includes(job.status || '')),
    [jobs]
  );

  const handleCreate = async () => {
    try {
      const conversation = await createConversation({
        type: chatType as ConversationType,
        title: chatType === 'team_chat' ? title : undefined,
        jobId: chatType === 'job_discussion' ? selectedJobId : undefined,
        participantIds: chatType === 'team_chat' ? selectedParticipants : undefined,
      });

      // Reset form
      setTitle('');
      setSelectedJobId('');
      setSelectedParticipants([]);
      setChatType('team_chat');

      onCreated?.(conversation as ConversationWithDetails);
    } catch (error) {
      // Error handled by hook
    }
  };

  const toggleParticipant = (memberId: string) => {
    setSelectedParticipants(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const isValid = chatType === 'team_chat'
    ? title.trim().length > 0 && selectedParticipants.length > 0
    : !!selectedJobId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Start a New Conversation</DialogTitle>
          <DialogDescription>
            Create a team chat or start a job discussion
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Chat Type Selection */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setChatType('team_chat')}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                chatType === 'team_chat'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <Users className={`h-6 w-6 ${chatType === 'team_chat' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-sm font-medium ${chatType === 'team_chat' ? 'text-primary' : ''}`}>
                Team Chat
              </span>
            </button>

            <button
              type="button"
              onClick={() => setChatType('job_discussion')}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                chatType === 'job_discussion'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <Briefcase className={`h-6 w-6 ${chatType === 'job_discussion' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-sm font-medium ${chatType === 'job_discussion' ? 'text-primary' : ''}`}>
                Job Discussion
              </span>
            </button>
          </div>

          {/* Team Chat Fields */}
          {chatType === 'team_chat' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="title">Chat Name</Label>
                <Input
                  id="title"
                  placeholder="e.g., Morning Standup, Project Alpha..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Add Participants</Label>
                <ScrollArea className="h-[200px] rounded-md border">
                  {membersLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                      No team members found
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {teamMembers.map((member) => (
                        <label
                          key={member.id}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedParticipants.includes(member.id)}
                            onCheckedChange={() => toggleParticipant(member.id)}
                          />
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {member.first_name?.[0]}{member.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {member.first_name} {member.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {member.role}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                {selectedParticipants.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedParticipants.length} participant{selectedParticipants.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            </>
          )}

          {/* Job Discussion Fields */}
          {chatType === 'job_discussion' && (
            <div className="space-y-2">
              <Label htmlFor="job">Select Job</Label>
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger id="job">
                  <SelectValue placeholder="Choose a job..." />
                </SelectTrigger>
                <SelectContent>
                  {jobsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : activeJobs.length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      No active jobs found
                    </div>
                  ) : (
                    activeJobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <span>{job.job_number}</span>
                          <span className="text-muted-foreground">-</span>
                          <span className="truncate">{job.title}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Job discussions automatically include all assigned workers
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!isValid || isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <MessageSquare className="h-4 w-4 mr-2" />
                Create Chat
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
