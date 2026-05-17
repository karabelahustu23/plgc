import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useListFamilyMembers, getListFamilyMembersQueryKey, useCreateFamilyMember, useUpdateFamilyMember, useDeleteFamilyMember, useListMemberEsims, getListMemberEsimsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Pencil, Trash2, Smartphone } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function MemberEsims({ memberId }: { memberId: string }) {
  const { data: esims, isLoading } = useListMemberEsims(
    memberId,
    { query: { enabled: !!memberId, queryKey: getListMemberEsimsQueryKey(memberId) } }
  );

  if (isLoading) return <div className="py-2 text-sm text-muted-foreground">Loading eSIMs...</div>;
  
  if (!esims || esims.length === 0) {
    return <div className="py-2 text-sm text-muted-foreground">No active eSIMs</div>;
  }

  return (
    <div className="space-y-3 mt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Plans</p>
      {esims.map(esim => (
        <div key={esim.orderId} className="flex items-center justify-between bg-secondary/50 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <div className="bg-background rounded-full p-2">
              <Smartphone className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{esim.locationName || esim.locationCode}</p>
              <p className="text-xs text-muted-foreground">{esim.packageName}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{esim.dataRemaining != null ? `${esim.dataRemaining.toFixed(1)} ${esim.dataUnit}` : 'N/A'}</p>
            <p className="text-xs text-muted-foreground">remaining</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Family() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("👤");

  const { data: members, isLoading, refetch } = useListFamilyMembers(
    { userId: user?.uid || "" },
    { query: { enabled: !!user?.uid, queryKey: getListFamilyMembersQueryKey({ userId: user?.uid || "" }) } }
  );

  const createMember = useCreateFamilyMember();
  const updateMember = useUpdateFamilyMember();
  const deleteMember = useDeleteFamilyMember();

  const handleAdd = async () => {
    if (!user || !name) return;
    try {
      await createMember.mutateAsync({
        data: { userId: user.uid, name, emoji }
      });
      toast({ title: "Member added" });
      setIsAddOpen(false);
      setName("");
      setEmoji("👤");
      refetch();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = async () => {
    if (!editingMember || !name) return;
    try {
      await updateMember.mutateAsync({
        memberId: editingMember.id,
        data: { name, emoji }
      });
      toast({ title: "Member updated" });
      setIsEditOpen(false);
      refetch();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this family member?")) return;
    try {
      await deleteMember.mutateAsync({ memberId: id });
      toast({ title: "Member removed" });
      refetch();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openEdit = (member: any) => {
    setEditingMember(member);
    setName(member.name);
    setEmoji(member.emoji || "👤");
    setIsEditOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold">Family Members</h1>
          <p className="text-muted-foreground mt-2">Manage eSIMs for your family from one wallet</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Member
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading family members...</div>
      ) : members?.length === 0 ? (
        <div className="text-center py-20 bg-secondary/30 rounded-xl border border-dashed">
          <Users className="mx-auto h-16 w-16 text-muted-foreground mb-4 opacity-50" />
          <h3 className="font-medium text-xl">No family members yet</h3>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Add family members to easily purchase and manage eSIMs for them using your shared wallet balance.
          </p>
          <Button onClick={() => setIsAddOpen(true)} className="mt-6 gap-2" variant="outline">
            <Plus className="h-4 w-4" /> Add First Member
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {members?.map(member => (
            <Card key={member.id} className="relative overflow-hidden">
              <div className="absolute top-4 right-4 flex gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(member)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(member.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <Avatar className="h-16 w-16 text-2xl border bg-secondary/50">
                  <AvatarFallback className="bg-transparent">{member.emoji || "👤"}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-xl">{member.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Added {new Date(member.createdAt).toLocaleDateString()}</p>
                </div>
              </CardHeader>
              <CardContent>
                <MemberEsims memberId={member.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Family Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Partner, Kid" />
            </div>
            <div className="space-y-2">
              <Label>Emoji (Optional)</Label>
              <Input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="👤" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!name || createMember.isPending}>
              {createMember.isPending ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Family Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Emoji (Optional)</Label>
              <Input value={emoji} onChange={e => setEmoji(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!name || updateMember.isPending}>
              {updateMember.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
