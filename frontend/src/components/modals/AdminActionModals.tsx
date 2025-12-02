'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface QuickActionsModalProps extends ModalProps {
  onAddItem: () => void;
  onCreateRequisition: () => void;
  onCreatePO: () => void;
  onAddSupplier: () => void;
}

export function QuickActionsModal({ isOpen, onClose, onAddItem, onCreateRequisition, onCreatePO, onAddSupplier }: QuickActionsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold font-sf-pro-display text-gray-900">Quick Actions</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 mt-4">
          <Button onClick={() => { onClose(); onAddItem(); }}>Add New Item</Button>
          <Button onClick={() => { onClose(); onCreateRequisition(); }}>Create Requisition</Button>
          <Button onClick={() => { onClose(); onCreatePO(); }}>Create PO</Button>
          <Button onClick={() => { onClose(); onAddSupplier(); }}>Add Supplier</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AddNewItemModal({ isOpen, onClose }: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold font-sf-pro-display text-gray-900">Add New Item</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 mt-4">
          <div>
            <Label htmlFor="itemName">Item Name</Label>
            <Input id="itemName" placeholder="Enter item name" className="bg-white/50 backdrop-blur-sm border-gray-200/50" />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select>
              <SelectTrigger className="bg-white/50 backdrop-blur-sm border-gray-200/50">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="food">Food</SelectItem>
                <SelectItem value="beverage">Beverage</SelectItem>
                <SelectItem value="equipment">Equipment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input id="quantity" type="number" placeholder="Enter quantity" className="bg-white/50 backdrop-blur-sm border-gray-200/50" />
          </div>
          <Button onClick={() => {}}>Add Item</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CreateRequisitionModal({ isOpen, onClose }: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold font-sf-pro-display text-gray-900">Create Requisition</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 mt-4">
          <div>
            <Label htmlFor="department">Department</Label>
            <Select>
              <SelectTrigger className="bg-white/50 backdrop-blur-sm border-gray-200/50">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kitchen">Kitchen</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="housekeeping">Housekeeping</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="items">Items</Label>
            <Select>
              <SelectTrigger className="bg-white/50 backdrop-blur-sm border-gray-200/50">
                <SelectValue placeholder="Select items" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="item1">Item 1</SelectItem>
                <SelectItem value="item2">Item 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" placeholder="Enter any additional notes" className="bg-white/50 backdrop-blur-sm border-gray-200/50" />
          </div>
          <Button onClick={() => {}}>Create Requisition</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CreatePOModal({ isOpen, onClose }: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold font-sf-pro-display text-gray-900">Create Purchase Order</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 mt-4">
          <div>
            <Label htmlFor="supplier">Supplier</Label>
            <Select>
              <SelectTrigger className="bg-white/50 backdrop-blur-sm border-gray-200/50">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="supplier1">Supplier 1</SelectItem>
                <SelectItem value="supplier2">Supplier 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="items">Items</Label>
            <Select>
              <SelectTrigger className="bg-white/50 backdrop-blur-sm border-gray-200/50">
                <SelectValue placeholder="Select items" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="item1">Item 1</SelectItem>
                <SelectItem value="item2">Item 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="deliveryDate">Delivery Date</Label>
            <Input id="deliveryDate" type="date" className="bg-white/50 backdrop-blur-sm border-gray-200/50" />
          </div>
          <Button onClick={() => {}}>Create PO</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AddSupplierModal({ isOpen, onClose }: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold font-sf-pro-display text-gray-900">Add Supplier</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 mt-4">
          <div>
            <Label htmlFor="name">Supplier Name</Label>
            <Input id="name" placeholder="Enter supplier name" className="bg-white/50 backdrop-blur-sm border-gray-200/50" />
          </div>
          <div>
            <Label htmlFor="contact">Contact Person</Label>
            <Input id="contact" placeholder="Enter contact person name" className="bg-white/50 backdrop-blur-sm border-gray-200/50" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="Enter email address" className="bg-white/50 backdrop-blur-sm border-gray-200/50" />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" placeholder="Enter phone number" className="bg-white/50 backdrop-blur-sm border-gray-200/50" />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" placeholder="Enter address" className="bg-white/50 backdrop-blur-sm border-gray-200/50" />
          </div>
          <Button onClick={() => {}}>Add Supplier</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
