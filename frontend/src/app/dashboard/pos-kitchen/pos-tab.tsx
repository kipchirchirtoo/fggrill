"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useBranch } from "@/lib/branch-context";
import { IOSCard } from "@/components/ui/ios-card";
import { IOSButton } from "@/components/ui/ios-button";
import { restaurantAPI, staffAPI, receiptsAPI } from "@/lib/api";
import { toast } from "sonner";
import {
  Search,
  ChefHat,
  Plus,
  Minus,
  X,
  ShoppingCart,
  Soup,
  FileText,
  RefreshCw,
} from "lucide-react";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import {
  KeyboardShortcutOverlay,
  useKeyboardShortcutOverlay,
} from "@/components/KeyboardShortcutOverlay";
import { ShortcutBadge } from "@/components/ui/ShortcutBadge";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category_id: string;
  image_url?: string;
  is_available: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface CartItem extends MenuItem {
  quantity: number;
  notes?: string;
}

interface TodayOrder {
  id: string;
  order_number: string;
  order_type: string;
  table_number?: string;
  room_number?: string;
  status: string;
  total: number;
  created_at: string;
  payment_method?: string;
  waiter_id?: string;
  waiter_name?: string;
  items?: Array<{
    name: string;
    quantity: number;
    unit_price: number;
  }>;
}

interface Waiter {
  id: string;
  first_name: string;
  last_name: string;
  status: "active" | "inactive";
}

interface POSTabProps {
  onOrderCreated?: () => void;
}

export function POSTab({ onOrderCreated }: POSTabProps) {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const shortcutOverlay = useKeyboardShortcutOverlay("pos");

  // Menu state
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<
    "dine_in" | "takeaway" | "room_service"
  >("dine_in");
  const [tableNumber, setTableNumber] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mpesa" | "card">(
    "cash",
  );
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Today's orders
  const [todayOrders, setTodayOrders] = useState<TodayOrder[]>([]);
  const [isGeneratingBill, setIsGeneratingBill] = useState<string | null>(null);
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [selectedRecallOrder, setSelectedRecallOrder] =
    useState<TodayOrder | null>(null);

  // Waiters
  const [waiters, setWaiters] = useState<Waiter[]>([]);

  // Barcode scanning state
  const barcodeBufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchMenuData = useCallback(async () => {
    try {
      const [itemsRes, categoriesRes, waitersRes] = await Promise.all([
        restaurantAPI.getMenuItems(
          undefined,
          currentBranchId || undefined,
          true,
        ),
        restaurantAPI.getCategories(),
        staffAPI.getStaffMembers({
          branchId: currentBranchId || undefined,
          role: "waiter",
        }),
      ]);

      if (itemsRes.success) setMenuItems(itemsRes.data || []);
      if (categoriesRes.success) setCategories(categoriesRes.data || []);
      if (waitersRes.success) {
        // Map backend response to frontend format
        const mappedWaiters = (waitersRes.data || [])
          .map((w: any) => ({
            id: w.id,
            first_name: w.user?.first_name || w.first_name || "",
            last_name: w.user?.last_name || w.last_name || "",
            status: w.status || "active",
          }))
          .filter((w: Waiter) => w.status === "active");
        setWaiters(mappedWaiters);
      }
    } catch (error) {
      console.error("Error fetching menu:", error);
    }
  }, [currentBranchId]);

  const fetchTodayOrders = useCallback(async () => {
    if (!currentBranchId) return;
    try {
      const response = await restaurantAPI.getTodayOrders(currentBranchId);
      if (response.success) setTodayOrders(response.data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  }, [currentBranchId]);

  useEffect(() => {
    fetchMenuData();
    fetchTodayOrders();
  }, [fetchMenuData, fetchTodayOrders]);

  // Barcode Scanner Listener
  useEffect(() => {
    const handleKeyPress = async (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      ) {
        return;
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;

      // Barcode scanners typically input very fast (< 50ms between chars)
      // If time between keys is > 100ms, reset buffer (user is typing manually)
      if (timeDiff > 100) {
        barcodeBufferRef.current = "";
      }

      lastKeyTimeRef.current = currentTime;

      // Handle Enter key (barcode scan complete)
      if (e.key === "Enter" && barcodeBufferRef.current.length > 0) {
        e.preventDefault();
        const barcode = barcodeBufferRef.current.trim();
        barcodeBufferRef.current = "";

        // Search for item by barcode/name
        try {
          const res = await restaurantAPI.getMenuItems(
            undefined,
            currentBranchId || undefined,
            true,
          );
          if (res.success && res.data) {
            // Try exact match first (case-insensitive)
            const item = res.data.find(
              (i: MenuItem) =>
                i.name.toLowerCase() === barcode.toLowerCase() ||
                i.name.toLowerCase().includes(barcode.toLowerCase()),
            );

            if (item && item.is_available) {
              addToCart(item);
              toast.success(`Added: ${item.name}`);
            } else {
              toast.error(`Item not found: ${barcode}`);
            }
          }
        } catch (error) {
          console.error("Barcode scan error:", error);
        }
      } else if (e.key.length === 1) {
        // Accumulate character
        barcodeBufferRef.current += e.key;

        // Clear buffer after 200ms of inactivity
        if (barcodeTimeoutRef.current) {
          clearTimeout(barcodeTimeoutRef.current);
        }
        barcodeTimeoutRef.current = setTimeout(() => {
          barcodeBufferRef.current = "";
        }, 200);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, [currentBranchId, menuItems]);

  const addToCart = (item: MenuItem) => {
    const existing = cart.find((c) => c.id === item.id);
    if (existing) {
      setCart(
        cart.map((c) =>
          c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c,
        ),
      );
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: string, change: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.id === id) {
            const newQuantity = item.quantity + change;
            return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
          }
          return item;
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setTableNumber("");
    setRoomNumber("");
    setCustomerName("");
    setSelectedWaiterId("");
  };

  const handleCreateOrder = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    if (isSubmitting) return;

    if (orderType === "dine_in" && !tableNumber) {
      toast.error("Please enter table number");
      return;
    }
    if (orderType === "dine_in" && !selectedWaiterId) {
      toast.error("Please select a waiter for dine-in orders");
      return;
    }
    if (orderType === "room_service" && !roomNumber) {
      toast.error("Please enter room number");
      return;
    }

    setIsSubmitting(true);
    try {
      const total = cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      const subtotal = Math.round(total / 1.16);
      const tax = total - subtotal;

      const orderItems = cart.map((item) => ({
        menu_item_id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_amount: item.price * item.quantity,
        notes: item.notes,
      }));

      const selectedWaiter = waiters.find((w) => w.id === selectedWaiterId);

      const orderData = {
        order_type: orderType,
        table_number: orderType === "dine_in" ? tableNumber : undefined,
        room_number: orderType === "room_service" ? roomNumber : undefined,
        customer_name: customerName || undefined,
        payment_method: paymentMethod,
        waiter_id: selectedWaiterId || undefined,
        waiter_name: selectedWaiter
          ? `${selectedWaiter.first_name} ${selectedWaiter.last_name}`
          : undefined,
        branch_id: currentBranchId,
        items: orderItems,
        subtotal,
        tax,
        total,
        status: "pending",
      };

      const response = await restaurantAPI.createOrder(orderData);
      const orderNumber =
        response.data?.order_number || `ORD-${Date.now().toString().slice(-6)}`;

      toast.success(`Order #${orderNumber} created successfully!`);
      clearCart();
      fetchTodayOrders();
      onOrderCreated?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to create order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateBill = async (order: TodayOrder) => {
    setIsGeneratingBill(order.id);
    try {
      // console.log('[POS] ========== BILL GENERATION DEBUG ==========');
      // console.log('[POS] Full order object:', JSON.stringify(order, null, 2));
      // console.log('[POS] User object:', JSON.stringify(user, null, 2));
      // console.log('[POS] Order waiter_name:', order.waiter_name);
      // console.log('[POS] User firstName:', user?.firstName);
      // console.log('[POS] User lastName:', user?.lastName);

      const servedBy =
        order.waiter_name ||
        (user?.firstName
          ? `${user.firstName} ${user.lastName || ""}`
          : "Staff");
      // console.log('[POS] Final served_by value:', servedBy);
      // console.log('[POS] ===============================================');

      const receiptData = {
        receipt_type: "sale" as const,
        receipt_number: order.order_number,
        short_code: order.short_code || order.shortCode,
        public_code: order.short_code || order.shortCode,
        barcode_value: order.short_code || order.shortCode || order.order_number,
        date: new Date(order.created_at).toLocaleString(),
        table_number: order.table_number,
        room_number: order.room_number,
        customer_name: order.table_number
          ? `Table ${order.table_number}`
          : "Walk-in",
        cashier_name: user?.firstName
          ? `${user.firstName} ${user.lastName || ""}`
          : "Staff",
        served_by: servedBy,
        items:
          order.items?.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.unit_price * item.quantity,
          })) || [],
        total_amount: order.total,
        subtotal: Math.round(order.total / 1.16),
        tax_amount: order.total - Math.round(order.total / 1.16),
        payment_method: order.payment_method || "Cash",
        amount_paid: order.total,
        change_amount: 0,
      };

      // Try thermal printing first
      try {
        const printResult = await receiptsAPI.printReceipt(receiptData);
        if (printResult.success) {
          toast.success("Receipt printed successfully!");
          return;
        }
      } catch (printError) {
        // console.log('Thermal printing failed, falling back to PDF');
      }

      // Fallback to PDF generation
      const response = await restaurantAPI.generateBill(receiptData);

      if (response.success) {
        if (response.data?.pdf_base64) {
          // Online mode: Download PDF
          const byteCharacters = atob(response.data.pdf_base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: "application/pdf" });

          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download =
            response.data.filename || `bill_${order.order_number}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          toast.success(`Bill generated for Order #${order.order_number}!`);
        } else {
          // Offline mode: Show success message (receipt data is already in receiptData)
          // console.log('[POS] Offline mode - bill generated without PDF');
          // console.log('[POS] Receipt data:', receiptData);
          toast.success(
            `Bill generated for Order #${order.order_number} (Offline Mode)`,
          );
        }
      } else {
        throw new Error(response.message || "Failed to generate bill");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to generate bill");
    } finally {
      setIsGeneratingBill(null);
    }
  };

  const handleRecallBill = (order: TodayOrder) => {
    setSelectedRecallOrder(order);
    setShowRecallModal(true);
  };

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory =
      selectedCategory === "all" || item.category_id === selectedCategory;
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch && item.is_available;
  });

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subtotal = Math.round(total / 1.16);
  const tax = total - subtotal;

  // ========== KEYBOARD SHORTCUTS ==========

  // Focus search (F2 or /)
  useKeyboardShortcut(["f2", "/"], () => {
    const searchInput = document.querySelector(
      'input[placeholder*="Search menu"]',
    ) as HTMLInputElement;
    searchInput?.focus();
  });

  // Send to kitchen (Ctrl+S)
  useKeyboardShortcut(
    "ctrl+s",
    () => {
      if (
        cart.length > 0 &&
        !isSubmitting &&
        (orderType !== "dine_in" || selectedWaiterId)
      ) {
        handleCreateOrder();
      }
    },
    { enabled: cart.length > 0 && !isSubmitting },
  );

  // Generate bill (Ctrl+P)
  useKeyboardShortcut(
    "ctrl+p",
    () => {
      if (cart.length > 0 && (orderType !== "dine_in" || selectedWaiterId)) {
        const selectedWaiter = waiters.find((w) => w.id === selectedWaiterId);
        const waiterName = selectedWaiter
          ? `${selectedWaiter.first_name} ${selectedWaiter.last_name}`
          : undefined;
        handleGenerateBill({
          id: "current-cart",
          order_number: `ORD-${Date.now().toString().slice(-6)}`,
          order_type: orderType,
          table_number: orderType === "dine_in" ? tableNumber : undefined,
          room_number: orderType === "room_service" ? roomNumber : undefined,
          status: "pending",
          total: total,
          created_at: new Date().toISOString(),
          payment_method: paymentMethod,
          waiter_id: selectedWaiterId || undefined,
          waiter_name: waiterName,
          items: cart.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unit_price: item.price,
          })),
        } as TodayOrder);
      }
    },
    { enabled: cart.length > 0 },
  );

  // New order / Clear cart (Ctrl+N)
  useKeyboardShortcut(
    "ctrl+n",
    () => {
      if (cart.length > 0) {
        clearCart();
      }
    },
    { enabled: cart.length > 0 },
  );

  // Dine-in mode (Ctrl+D)
  useKeyboardShortcut("ctrl+d", () => {
    setOrderType("dine_in");
  });

  // Takeaway mode (Ctrl+T)
  useKeyboardShortcut("ctrl+t", () => {
    setOrderType("takeaway");
  });

  // Room service mode (Ctrl+R)
  useKeyboardShortcut("ctrl+r", () => {
    setOrderType("room_service");
  });

  // Cash payment (Ctrl+1)
  useKeyboardShortcut("ctrl+1", () => {
    setPaymentMethod("cash");
  });

  // M-Pesa payment (Ctrl+2)
  useKeyboardShortcut("ctrl+2", () => {
    setPaymentMethod("mpesa");
  });

  // Card payment (Ctrl+3)
  useKeyboardShortcut("ctrl+3", () => {
    setPaymentMethod("card");
  });

  // Recall order (Ctrl+H)
  useKeyboardShortcut("ctrl+h", () => {
    setShowRecallModal(true);
  });

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-4 h-full">
        {/* Menu Items */}
        <div className="flex-1 overflow-hidden">
          <div className="bg-white border border-gray-200 rounded-lg flex flex-col min-h-0">
            <div className="p-4 border-b border-gray-200 space-y-3">
              <div className="flex items-center justify-between lg:hidden mb-2">
                <h1 className="text-xl font-bold text-stone-900">Menu</h1>
                <IOSButton
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const cartElement = document.getElementById("cart-section");
                    cartElement?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="relative"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {cart.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                      {cart.reduce((a, b) => a + b.quantity, 0)}
                    </span>
                  )}
                </IOSButton>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search menu items... (F2 or /)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-9 pr-3 text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:bg-white"
                />
              </div>
            </div>

            <div className="p-4 border-b border-gray-200 bg-stone-50/50">
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar items-center">
                <button
                  className={`px-4 py-1.5 text-sm rounded-full whitespace-nowrap transition-all ${
                    selectedCategory === "all"
                      ? "bg-amber-500 text-white shadow-sm"
                      : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
                  }`}
                  onClick={() => setSelectedCategory("all")}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    className={`px-4 py-1.5 text-sm rounded-full whitespace-nowrap transition-all ${
                      selectedCategory === cat.id
                        ? "bg-amber-500 text-white shadow-sm"
                        : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 pb-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="bg-white border border-stone-200 rounded-xl p-3 cursor-pointer hover:shadow-md transition-all active:scale-95 group"
                  >
                    <div className="aspect-square bg-stone-50 rounded-lg mb-2.5 flex items-center justify-center overflow-hidden relative">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <Soup className="h-8 w-8 text-stone-300" />
                      )}
                      <div className="absolute top-1 right-1 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-amber-500 text-white p-1 rounded-full shadow-sm">
                          <Plus className="h-3 w-3" />
                        </div>
                      </div>
                    </div>
                    <h3 className="font-semibold text-[13px] leading-tight mb-1 line-clamp-2 text-stone-800 h-8 lg:h-7">
                      {item.name}
                    </h3>
                    <p className="text-amber-600 font-bold text-sm">
                      KES {item.price.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Cart & Orders */}
        <div id="cart-section" className="w-full lg:w-96 flex flex-col gap-4">
          {/* Current Order */}
          <div className="bg-white border border-gray-200 rounded-lg flex-1 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-base font-medium text-gray-900">
                Current Order
              </h2>

              {/* Order Type */}
              <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
                <button
                  className={`px-4 py-2 text-xs font-semibold rounded-full whitespace-nowrap transition-all flex items-center gap-1 ${
                    orderType === "dine_in"
                      ? "bg-stone-800 text-white shadow-sm"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                  onClick={() => setOrderType("dine_in")}
                >
                  <span>Dine In</span>
                  <ShortcutBadge
                    shortcut="ctrl+d"
                    variant="compact"
                    className={
                      orderType === "dine_in" ? "opacity-70" : "opacity-50"
                    }
                  />
                </button>
                <button
                  className={`px-4 py-2 text-xs font-semibold rounded-full whitespace-nowrap transition-all flex items-center gap-1 ${
                    orderType === "takeaway"
                      ? "bg-stone-800 text-white shadow-sm"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                  onClick={() => setOrderType("takeaway")}
                >
                  <span>Takeaway</span>
                  <ShortcutBadge
                    shortcut="ctrl+t"
                    variant="compact"
                    className={
                      orderType === "takeaway" ? "opacity-70" : "opacity-50"
                    }
                  />
                </button>
                <button
                  className={`px-4 py-2 text-xs font-semibold rounded-full whitespace-nowrap transition-all flex items-center gap-1 ${
                    orderType === "room_service"
                      ? "bg-stone-800 text-white shadow-sm"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                  onClick={() => setOrderType("room_service")}
                >
                  <span>Room Service</span>
                  <ShortcutBadge
                    shortcut="ctrl+r"
                    variant="compact"
                    className={
                      orderType === "room_service" ? "opacity-70" : "opacity-50"
                    }
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 mt-4">
                {/* Table/Room Number */}
                {orderType === "dine_in" && (
                  <div>
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 block">
                      Table Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 12"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      className="w-full h-11 px-3 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-400/20 focus:bg-white transition-all"
                    />
                  </div>
                )}
                {orderType === "room_service" && (
                  <div>
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 block">
                      Room Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 204"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      className="w-full h-11 px-3 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-400/20 focus:bg-white transition-all"
                    />
                  </div>
                )}

                {/* Waiter Selection */}
                {orderType === "dine_in" && (
                  <div>
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 block">
                      Assigned Waiter *
                    </label>
                    <select
                      value={selectedWaiterId}
                      onChange={(e) => setSelectedWaiterId(e.target.value)}
                      className="w-full h-11 px-3 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-400/20 focus:bg-white transition-all"
                      required
                    >
                      <option value="">Select waiter</option>
                      {waiters.map((waiter) => (
                        <option key={waiter.id} value={waiter.id}>
                          {waiter.first_name} {waiter.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">Cart is empty</p>
                  <p className="text-xs">Tap items to add</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2 bg-stone-50 rounded-ios-lg border border-stone-100 hover:border-stone-200 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[13px] text-stone-800 truncate">
                          {item.name}
                        </p>
                        <p className="text-amber-600 text-[12px] font-medium">
                          KES {(item.price * item.quantity).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-lg p-0.5">
                        <button
                          className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-600"
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center text-[13px] font-bold text-stone-700">
                          {item.quantity}
                        </span>
                        <button
                          className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-600"
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-500 ml-0.5"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div className="p-4 border-t border-gray-200 space-y-3">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal (excl. VAT)</span>
                  <span>KES {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>VAT (16% incl.)</span>
                  <span>KES {tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-medium text-gray-900 pt-1 border-t border-gray-200">
                  <span>TOTAL</span>
                  <span>KES {total.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-100">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">
                  Payment Method
                </p>
                <div className="flex gap-2">
                  <button
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex flex-col items-center gap-0.5 ${
                      paymentMethod === "cash"
                        ? "bg-white text-stone-900 shadow-sm border border-stone-200 ring-2 ring-amber-400/50"
                        : "bg-stone-200/50 text-stone-600 border border-transparent hover:bg-stone-200"
                    }`}
                    onClick={() => setPaymentMethod("cash")}
                  >
                    <span>Cash</span>
                    <ShortcutBadge
                      shortcut="ctrl+1"
                      variant="compact"
                      className="opacity-60"
                    />
                  </button>
                  <button
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex flex-col items-center gap-0.5 ${
                      paymentMethod === "mpesa"
                        ? "bg-white text-stone-900 shadow-sm border border-stone-200 ring-2 ring-amber-400/50"
                        : "bg-stone-200/50 text-stone-600 border border-transparent hover:bg-stone-200"
                    }`}
                    onClick={() => setPaymentMethod("mpesa")}
                  >
                    <span>M-Pesa</span>
                    <ShortcutBadge
                      shortcut="ctrl+2"
                      variant="compact"
                      className="opacity-60"
                    />
                  </button>
                  <button
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex flex-col items-center gap-0.5 ${
                      paymentMethod === "card"
                        ? "bg-white text-stone-900 shadow-sm border border-stone-200 ring-2 ring-amber-400/50"
                        : "bg-stone-200/50 text-stone-600 border border-transparent hover:bg-stone-200"
                    }`}
                    onClick={() => setPaymentMethod("card")}
                  >
                    <span>Card</span>
                    <ShortcutBadge
                      shortcut="ctrl+3"
                      variant="compact"
                      className="opacity-60"
                    />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleCreateOrder}
                  disabled={
                    cart.length === 0 ||
                    isSubmitting ||
                    (orderType === "dine_in" && !selectedWaiterId)
                  }
                  className="w-full bg-stone-800 text-white font-bold h-12 rounded-xl shadow-lg shadow-stone-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <ChefHat className="h-5 w-5" />
                      <span>Send to Kitchen</span>
                      <ShortcutBadge shortcut="ctrl+s" variant="inline" />
                    </>
                  )}
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      // Generate bill for current cart items
                      if (cart.length === 0) {
                        toast.error("Cart is empty");
                        return;
                      }
                      if (orderType === "dine_in" && !selectedWaiterId) {
                        toast.error("Please select a waiter");
                        return;
                      }
                      const total = cart.reduce(
                        (sum, item) => sum + item.price * item.quantity,
                        0,
                      );
                      const subtotal = Math.round(total / 1.16);
                      const tax = total - subtotal;
                      const selectedWaiter = waiters.find(
                        (w) => w.id === selectedWaiterId,
                      );
                      const waiterName = selectedWaiter
                        ? `${selectedWaiter.first_name} ${selectedWaiter.last_name}`
                        : undefined;

                      handleGenerateBill({
                        id: "current-cart",
                        order_number: `ORD-${Date.now().toString().slice(-6)}`,
                        order_type: orderType,
                        table_number:
                          orderType === "dine_in" ? tableNumber : undefined,
                        room_number:
                          orderType === "room_service" ? roomNumber : undefined,
                        status: "pending",
                        total: total,
                        created_at: new Date().toISOString(),
                        payment_method: paymentMethod,
                        waiter_id: selectedWaiterId || undefined,
                        waiter_name: waiterName,
                        items: cart.map((item) => ({
                          name: item.name,
                          quantity: item.quantity,
                          unit_price: item.price,
                        })),
                      } as TodayOrder);
                    }}
                    disabled={cart.length === 0}
                    className="bg-white border-2 border-stone-200 text-stone-700 font-bold h-11 rounded-xl active:scale-[0.98] transition-all disabled:opacity-50 flex flex-col items-center justify-center gap-0.5 py-1"
                  >
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-4 w-4" />
                      <span>Bill</span>
                    </div>
                    <ShortcutBadge
                      shortcut="ctrl+p"
                      variant="compact"
                      className="opacity-60"
                    />
                  </button>

                  <button
                    onClick={clearCart}
                    disabled={cart.length === 0}
                    className="bg-white border-2 border-red-100 text-red-500 font-bold h-11 rounded-xl active:scale-[0.98] transition-all disabled:opacity-50 flex flex-col items-center justify-center gap-0.5 py-1"
                  >
                    <div className="flex items-center gap-1.5">
                      <X className="h-4 w-4" />
                      <span>Clear</span>
                    </div>
                    <ShortcutBadge
                      shortcut="ctrl+n"
                      variant="compact"
                      className="opacity-60"
                    />
                  </button>
                </div>

                {/* Recall Bill Button */}
                <button
                  onClick={() => setShowRecallModal(true)}
                  className="w-full bg-blue-600 text-white font-bold h-11 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Recall Bill</span>
                  <ShortcutBadge shortcut="ctrl+h" variant="inline" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recall Bill Modal */}
      {showRecallModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowRecallModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Recall Bill - Today's Orders
              </h2>
              <button
                onClick={() => setShowRecallModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
              {todayOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No orders found for today</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayOrders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-blue-400 transition-all cursor-pointer"
                      onClick={() => {
                        handleRecallBill(order);
                        setShowRecallModal(false);
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-gray-900">
                            Order #{order.order_number}
                          </p>
                          <p className="text-sm text-gray-500">
                            {order.order_type === "dine_in" &&
                              order.table_number &&
                              `Table ${order.table_number}`}
                            {order.order_type === "room_service" &&
                              order.room_number &&
                              `Room ${order.room_number}`}
                            {order.order_type === "takeaway" && "Takeaway"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-gray-900">
                            KES {order.total.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(order.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>

                      {order.items && order.items.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 mb-2">
                            Items:
                          </p>
                          <div className="space-y-1">
                            {order.items.slice(0, 3).map((item, idx) => (
                              <p key={idx} className="text-sm text-gray-600">
                                {item.quantity}x {item.name}
                              </p>
                            ))}
                            {order.items.length > 3 && (
                              <p className="text-xs text-gray-400">
                                +{order.items.length - 3} more items
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-semibold ${
                            order.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : order.status === "pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {order.status}
                        </span>
                        {order.waiter_name && (
                          <p className="text-xs text-gray-500">
                            Served by: {order.waiter_name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  fetchTodayOrders();
                  toast.success("Orders refreshed");
                }}
                className="w-full bg-gray-200 text-gray-700 font-semibold h-11 rounded-xl hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh Orders</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal (after recall) */}
      {selectedRecallOrder && !showRecallModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedRecallOrder(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-500 to-blue-600">
              <h2 className="text-xl font-bold text-white">
                Order #{selectedRecallOrder.order_number}
              </h2>
              <button
                onClick={() => setSelectedRecallOrder(null)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 font-semibold">Order Type</p>
                  <p className="text-gray-900 capitalize">
                    {selectedRecallOrder.order_type.replace("_", " ")}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 font-semibold">Status</p>
                  <p className="text-gray-900 capitalize">
                    {selectedRecallOrder.status}
                  </p>
                </div>
                {selectedRecallOrder.table_number && (
                  <div>
                    <p className="text-gray-500 font-semibold">Table</p>
                    <p className="text-gray-900">
                      {selectedRecallOrder.table_number}
                    </p>
                  </div>
                )}
                {selectedRecallOrder.room_number && (
                  <div>
                    <p className="text-gray-500 font-semibold">Room</p>
                    <p className="text-gray-900">
                      {selectedRecallOrder.room_number}
                    </p>
                  </div>
                )}
                {selectedRecallOrder.waiter_name && (
                  <div className="col-span-2">
                    <p className="text-gray-500 font-semibold">Served By</p>
                    <p className="text-gray-900">
                      {selectedRecallOrder.waiter_name}
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  Order Items
                </p>
                <div className="space-y-2">
                  {selectedRecallOrder.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="font-semibold text-gray-900">
                        KES {(item.unit_price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal (excl. VAT)</span>
                  <span className="text-gray-900">
                    KES{" "}
                    {Math.round(
                      selectedRecallOrder.total / 1.16,
                    ).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT (16%)</span>
                  <span className="text-gray-900">
                    KES{" "}
                    {(
                      selectedRecallOrder.total -
                      Math.round(selectedRecallOrder.total / 1.16)
                    ).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                  <span className="text-gray-900">TOTAL</span>
                  <span className="text-gray-900">
                    KES {selectedRecallOrder.total.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
              <button
                onClick={() => {
                  handleGenerateBill(selectedRecallOrder);
                  setSelectedRecallOrder(null);
                }}
                disabled={isGeneratingBill === selectedRecallOrder.id}
                className="w-full bg-blue-600 text-white font-bold h-12 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGeneratingBill === selectedRecallOrder.id ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-5 w-5" />
                    <span>Generate Bill</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setSelectedRecallOrder(null)}
                className="w-full bg-gray-200 text-gray-700 font-semibold h-11 rounded-xl hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcut Help Overlay */}
      <KeyboardShortcutOverlay
        isOpen={shortcutOverlay.isOpen}
        onClose={shortcutOverlay.close}
        currentModule="pos"
      />
    </>
  );
}
