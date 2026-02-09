import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface NewStockTakeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
}

export const NewStockTakeModal = ({ isOpen, onClose, onSubmit }: NewStockTakeModalProps) => {
    const [takeType, setTakeType] = useState('FULL');
    const [notes, setNotes] = useState('');

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] flex flex-col overflow-hidden max-h-[85vh] p-0">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle>Start New Stock Take</DialogTitle>
                    <DialogDescription>
                        Initialize a new inventory verification session for this branch.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="type">Take Type</Label>
                            <Select value={takeType} onValueChange={setTakeType}>
                                <SelectTrigger id="type">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="FULL">Full Inventory</SelectItem>
                                    <SelectItem value="PARTIAL">Partial/Cyclic</SelectItem>
                                    <SelectItem value="SPOT_CHECK">Spot Check</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="notes">Notes (Optional)</Label>
                            <Textarea
                                id="notes"
                                placeholder="Add any instructions or context..."
                                value={notes}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter className="p-4 border-t bg-stone-50">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => onSubmit({ take_type: takeType, notes })} className="bg-stone-900 text-white">Start Session</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
