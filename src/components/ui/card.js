// src/components/ui/card.js
export default function Card({ children }) {
  return (
    <div className="bg-white border rounded-xl shadow p-4">
      {children}
    </div>
  );
}
