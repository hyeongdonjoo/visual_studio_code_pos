import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const shops = ["버거킹", "김밥천국", "스타벅스"];
const notificationSound = new Audio("/alert.mp3.wav");

const shopIcons = {
  버거킹: "🍔",
  김밥천국: "🍙",
  스타벅스: "☕️",
};

const App = () => {
  const [selectedShop, setSelectedShop] = useState("버거킹");
  const [orders, setOrders] = useState([]);
  const [showStats, setShowStats] = useState(false);
  const [statType, setStatType] = useState("daily");
  const [menuPrices, setMenuPrices] = useState({});
  const [statsData, setStatsData] = useState({ totals: [], menus: {} });
  const [lastOrderId, setLastOrderId] = useState(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    const handleUserClick = () => setUserInteracted(true);
    window.addEventListener("click", handleUserClick);
    return () => window.removeEventListener("click", handleUserClick);
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "orders", selectedShop, "list"),
      orderBy("timestamp", "desc")
    );
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const newOrders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      if (newOrders.length && newOrders[0].id !== lastOrderId) {
        const order = newOrders[0];
        const orderRef = doc(db, "orders", selectedShop, "list", order.id);
        const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists() && orderSnap.data().statsProcessed) return;

        if (userInteracted) {
          notificationSound.play().catch(() => {});
        }
        setLastOrderId(order.id);

        const menuStats = {};
        order.items?.forEach((item) => {
          const name = item.name;
          const quantity = item.quantity ?? 0;
          const price = item.price ?? menuPrices[name] ?? 0;
          const total = quantity * price;
          if (!menuStats[name]) menuStats[name] = { quantity: 0, total: 0 };
          menuStats[name].quantity += quantity;
          menuStats[name].total += total;
        });

        const date = new Date(order.timestamp.seconds * 1000);
        const dateKey = date.toISOString().split("T")[0];
        const monthKey = dateKey.slice(0, 7);

        const updateStat = async (type, key, stats) => {
          const ref = doc(db, "stats", selectedShop, type, key);
          const snap = await getDoc(ref);
          const existing = snap.exists() ? snap.data() : {};

          for (const name in stats) {
            if (!existing[name]) existing[name] = { quantity: 0, total: 0 };
            existing[name].quantity += stats[name].quantity;
            existing[name].total += stats[name].total;
          }

          await setDoc(ref, existing);
        };

        await updateStat("daily", dateKey, menuStats);
        await updateStat("monthly", monthKey, menuStats);
        await updateDoc(orderRef, { statsProcessed: true });
      }

      setOrders(newOrders);
    });
    return () => unsubscribe();
  }, [selectedShop, lastOrderId, userInteracted, menuPrices]);

  useEffect(() => {
    const fetchMenuPrices = async () => {
      const snapshot = await getDocs(collection(db, "shops", selectedShop, "menus"));
      const prices = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data?.name?.ko && data?.price) {
          prices[data.name.ko] = data.price;
        }
      });
      setMenuPrices(prices);
    };
    fetchMenuPrices();
  }, [selectedShop]);

  useEffect(() => {
    const fetchStats = async () => {
      const statsRef = collection(db, "stats", selectedShop, statType);
      const snapshot = await getDocs(statsRef);
      const totals = [];
      const menus = {};
      snapshot.forEach((docSnap) => {
        const date = docSnap.id;
        const data = docSnap.data();
        let dayTotal = 0;
        menus[date] = {};
        Object.entries(data).forEach(([name, stat]) => {
          dayTotal += stat.total;
          menus[date][name] = stat;
        });
        totals.push({ date, total: dayTotal });
      });
      totals.sort((a, b) => a.date.localeCompare(b.date));
      setStatsData({ totals, menus });
      if (!selectedDate && totals.length) setSelectedDate(totals[totals.length - 1].date);
    };

    if (showStats) {
      fetchStats();
    }
  }, [selectedShop, statType, showStats]);

  const resetOrders = async () => {
    const snapshot = await getDocs(collection(db, "orders", selectedShop, "list"));
    for (const docSnap of snapshot.docs) {
      await deleteDoc(doc(db, "orders", selectedShop, "list", docSnap.id));
    }
    await updateDoc(doc(db, "orders", selectedShop), { orderCount: 0 });
  };

  const totalSales = selectedDate && statsData.menus[selectedDate]
    ? Object.values(statsData.menus[selectedDate]).reduce((acc, item) => acc + item.total, 0)
    : 0;

  const renderStatsContent = () => {
    const { totals, menus } = statsData;
    return (
      <>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={totals}>
            <XAxis dataKey="date" />
            <YAxis tickFormatter={(v) => v.toLocaleString()} />
            <Tooltip formatter={(v) => `${v.toLocaleString()}원`} />
            <Bar dataKey="total" fill="#3182CE" />
          </BarChart>
        </ResponsiveContainer>

        <div className="bg-white p-4 rounded-xl shadow border">
          <h2 className="font-semibold mb-2 text-lg">
            {shopIcons[selectedShop]} {statType === "daily" ? "일별" : "월별"} 메뉴별 판매금액
          </h2>

          <div className="mb-3">
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border px-3 py-1 rounded"
            >
              {Object.keys(menus).map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 text-sm">
            {selectedDate && menus[selectedDate] ? (
              <div className="mb-3">
                <div className="font-semibold text-gray-700">📅 {selectedDate}</div>
                {Object.entries(menus[selectedDate]).map(([name, data]) => (
                  <div key={name} className="flex justify-between border-b pb-1">
                    <span>{name} (총 {data.quantity}개)</span>
                    <span>{data.total.toLocaleString()}원</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500">해당 날짜의 데이터가 없습니다.</div>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 space-y-4">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex gap-2">
          {shops.map((shop) => (
            <button
              key={shop}
              onClick={() => setSelectedShop(shop)}
              className={`px-4 py-2 rounded-xl text-sm shadow-md ${
                selectedShop === shop ? "bg-blue-600 text-white" : "bg-white border"
              }`}
            >
              {shop}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetOrders}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow text-sm"
          >
            초기화
          </button>
          <button
            onClick={() => setShowStats(!showStats)}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl shadow text-sm"
          >
            {showStats ? "주문 목록 보기" : "매출 통계 보기"}
          </button>
        </div>
      </div>

      {showStats ? (
        <div className="space-y-6">
          <div className="flex gap-2">
            <button
              onClick={() => setStatType("daily")}
              className={`px-4 py-2 rounded-xl text-sm ${
                statType === "daily" ? "bg-blue-500 text-white" : "bg-white border"
              }`}
            >
              일별 매출
            </button>
            <button
              onClick={() => setStatType("monthly")}
              className={`px-4 py-2 rounded-xl text-sm ${
                statType === "monthly" ? "bg-blue-500 text-white" : "bg-white border"
              }`}
            >
              월별 매출
            </button>
          </div>

          {renderStatsContent()}

          <div className="text-right font-bold text-xl">
            💵 총 매출: {totalSales.toLocaleString()}원
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white p-4 rounded-xl shadow border border-gray-100"
            >
              <div className="font-bold">🧾 주문번호: {order.orderNumber}</div>
              <div>💰 총액: {order.totalPrice.toLocaleString()}원</div>
              <div className="text-sm whitespace-pre-wrap">
                🍽️ 메뉴:
                {order.items.map((i) => `\n- ${i.name} x${i.quantity}`).join("")}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                ⏰ {new Date(order.timestamp.seconds * 1000).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
