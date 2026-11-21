"use client";

import { useEffect, useState } from "react";
import manifest from "../bugs.json";

// Control build: NEXT_PUBLIC_NO_BUGS=1 turns every planted bug off.
const bugs = process.env.NEXT_PUBLIC_NO_BUGS === "1" ? { cartLostOnRefresh: false, discountAppliesTwice: false } : manifest;

const PRODUCTS = [
  { id: "mug", name: "Ceramic Mug", price: 12 },
  { id: "tote", name: "Canvas Tote", price: 20 },
  { id: "cap", name: "Wool Cap", price: 18 },
  { id: "pen", name: "Brass Pen", price: 8 },
];

type Cart = Record<string, number>;

export default function Shop() {
  const [cart, setCart] = useState<Cart>({});
  const [loaded, setLoaded] = useState(false);
  const [codes, setCodes] = useState(0); // how many times SAVE10 was applied
  const [codeInput, setCodeInput] = useState("");
  const [codeMsg, setCodeMsg] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [ordered, setOrdered] = useState(false);

  useEffect(() => {
    if (!bugs.cartLostOnRefresh) {
      try {
        setCart(JSON.parse(localStorage.getItem("cart") ?? "{}"));
      } catch {}
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded && !bugs.cartLostOnRefresh) localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart, loaded]);

  const change = (id: string, d: number) =>
    setCart((c) => {
      const q = (c[id] ?? 0) + d;
      const next = { ...c };
      if (q <= 0) delete next[id];
      else next[id] = q;
      return next;
    });

  const items = PRODUCTS.filter((p) => cart[p.id]);
  const count = items.reduce((n, p) => n + cart[p.id], 0);
  const subtotal = items.reduce((n, p) => n + p.price * cart[p.id], 0);
  const discount = subtotal * 0.1 * codes;
  const total = subtotal - discount;

  function applyCode() {
    if (codeInput.trim().toUpperCase() !== "SAVE10") return setCodeMsg("Invalid code");
    if (codes > 0 && !bugs.discountAppliesTwice) return setCodeMsg("Code already used on this order");
    setCodes((n) => n + 1);
    setCodeMsg("SAVE10 applied: 10% off");
  }

  function placeOrder() {
    if (!email.includes("@")) return setError("Enter a valid email address");
    setError("");
    setOrdered(true);
    setCart({});
  }

  if (ordered) return <main className="p-8"><h1 className="text-2xl font-bold">Thank you for your order!</h1></main>;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Toy Shop</h1>
        <span>Cart ({count})</span>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-4">
        {PRODUCTS.map((p) => (
          <div key={p.id} className="rounded border p-4">
            <h2 className="font-semibold">{p.name}</h2>
            <p>${p.price}</p>
            <button className="mt-2 rounded bg-black px-3 py-1 text-white" onClick={() => change(p.id, 1)}>
              Add to cart
            </button>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Your cart</h2>
        {items.length === 0 && <p>Your cart is empty</p>}
        {items.map((p) => (
          <div key={p.id} className="flex items-center gap-3 py-1">
            <span className="w-40">{p.name}</span>
            <button aria-label={`Decrease ${p.name}`} onClick={() => change(p.id, -1)}>-</button>
            <span>Qty: {cart[p.id]}</span>
            <button aria-label={`Increase ${p.name}`} onClick={() => change(p.id, 1)}>+</button>
          </div>
        ))}
        <p className="mt-2">Subtotal: ${subtotal.toFixed(2)}</p>
        {codes > 0 && <p>Discount: -${discount.toFixed(2)}</p>}
        <p className="font-semibold">Total: ${total.toFixed(2)}</p>

        <div className="mt-4 flex gap-2">
          <input className="rounded border px-2" placeholder="Discount code" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} />
          <button className="rounded border px-3" onClick={applyCode}>Apply</button>
        </div>
        {codeMsg && <p>{codeMsg}</p>}

        <div className="mt-6 flex gap-2">
          <input className="rounded border px-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="rounded bg-black px-3 py-1 text-white" onClick={placeOrder} disabled={count === 0}>
            Place order
          </button>
        </div>
        {error && <p className="text-red-600">{error}</p>}
      </section>
    </main>
  );
}
