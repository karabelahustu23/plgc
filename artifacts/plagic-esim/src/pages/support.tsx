import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useListSupportTickets, getListSupportTicketsQueryKey, useCreateSupportTicket, useReplyToTicket } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Plus, Clock, CheckCircle2 } from "lucide-react";

export default function Support() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("normal");
  
  const [replyText, setReplyText] = useState("");

  const { data: tickets, isLoading, refetch } = useListSupportTickets(
    { userId: user?.uid },
    { query: { enabled: !!user?.uid, queryKey: getListSupportTicketsQueryKey({ userId: user?.uid }) } }
  );

  const createTicket = useCreateSupportTicket();
  const replyTicket = useReplyToTicket();

  const handleCreateTicket = async () => {
    if (!user || !subject || !message) return;
    
    try {
      await createTicket.mutateAsync({
        data: { userId: user.uid, subject, message, priority }
      });
      toast({ title: "Ticket created successfully" });
      setIsNewTicketOpen(false);
      setSubject("");
      setMessage("");
      setPriority("normal");
      refetch();
    } catch (error: any) {
      toast({ title: "Failed to create ticket", description: error.message, variant: "destructive" });
    }
  };

  const handleReply = async () => {
    if (!user || !selectedTicket || !replyText) return;
    
    try {
      await replyTicket.mutateAsync({
        ticketId: selectedTicket.id,
        data: { userId: user.uid, message: replyText, isAdmin: false }
      });
      setReplyText("");
      refetch();
      // Update selected ticket locally to show new message immediately
      const newMessage = {
        id: Date.now().toString(),
        senderType: "user",
        content: replyText,
        createdAt: new Date().toISOString()
      };
      setSelectedTicket({ ...selectedTicket, messages: [...(selectedTicket.messages || []), newMessage] });
    } catch (error: any) {
      toast({ title: "Failed to send reply", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold">Support</h1>
          <p className="text-muted-foreground mt-2">We're here to help you stay connected</p>
        </div>
        <Button onClick={() => setIsNewTicketOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New Ticket
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <h2 className="font-semibold text-lg">Your Tickets</h2>
          {isLoading ? (
            <p className="text-muted-foreground">Loading tickets...</p>
          ) : tickets?.length === 0 ? (
            <Card className="bg-secondary/30 border-dashed">
              <CardContent className="p-6 text-center text-muted-foreground">
                <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>No support tickets yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tickets?.map(ticket => (
                <Card 
                  key={ticket.id} 
                  className={`cursor-pointer transition-colors hover:border-primary/50 ${selectedTicket?.id === ticket.id ? 'border-primary shadow-sm' : ''}`}
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                        ticket.status === 'open' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {ticket.status}
                      </span>
                      <span className="text-xs text-muted-foreground">{new Date(ticket.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <p className="font-medium text-sm line-clamp-1">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {ticket.messages?.[0]?.content || "No messages"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          {selectedTicket ? (
            <Card className="h-full flex flex-col">
              <CardHeader className="border-b bg-secondary/20 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{selectedTicket.subject}</CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        {selectedTicket.status === 'open' ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                        Status: {selectedTicket.status}
                      </span>
                      <span>Priority: {selectedTicket.priority || 'normal'}</span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col min-h-[400px]">
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {selectedTicket.messages?.map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.senderType === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.senderType === 'user' 
                          ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                          : 'bg-secondary text-secondary-foreground rounded-tl-sm'
                      }`}>
                        {msg.senderType === 'admin' && <p className="text-xs font-semibold mb-1 opacity-70">Plagic Support</p>}
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-[10px] text-right mt-2 opacity-70">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {selectedTicket.status === 'open' && (
                  <div className="p-4 border-t bg-secondary/10 flex gap-3">
                    <Textarea 
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Type your reply here..." 
                      className="min-h-[80px] resize-none"
                    />
                    <Button 
                      className="h-auto" 
                      onClick={handleReply} 
                      disabled={!replyText || replyTicket.isPending}
                    >
                      {replyTicket.isPending ? "Sending..." : "Reply"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full min-h-[400px] flex items-center justify-center bg-secondary/10 border-dashed">
              <CardContent className="text-center text-muted-foreground">
                <MessageSquare className="mx-auto h-12 w-12 mb-4 opacity-20" />
                <p>Select a ticket to view the conversation</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Support Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Cannot connect in Japan" />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea 
                value={message} 
                onChange={e => setMessage(e.target.value)} 
                placeholder="Describe your issue in detail..." 
                className="min-h-[120px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewTicketOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTicket} disabled={!subject || !message || createTicket.isPending}>
              {createTicket.isPending ? "Submitting..." : "Submit Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
