// src/components/ui/button.js
export default function Button({ children, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl font-bold ${
        active ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'
      }`}
    >
      {children}
    </button>
  );
}
