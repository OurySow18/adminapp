import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase"; 
import Chart from "../../components/chart/Chart";

const ChartContainer = ({ aspect, title }) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const today = new Date();
      const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1);

      const q = query(
        collection(db, "orders"),
        where("timeStamp", ">=", sixMonthsAgo),
        where("timeStamp", "<=", today)
      );

      try {
        const querySnapshot = await getDocs(q);
        const orders = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          timeStamp: doc.data().timeStamp.toDate(),
        }));

        // Aggregate data by month
        const aggregatedData = Array(6).fill(0).map((_, index) => {
          const date = new Date(today.getFullYear(), today.getMonth() - 5 + index, 1);
          return { name: date.toLocaleString('default', { month: 'long' }), Total: 0 };
        });

        orders.forEach(order => {
          const orderMonth = order.timeStamp.getMonth();
          const orderYear = order.timeStamp.getFullYear();
          const monthIndex = aggregatedData.findIndex(data => {
            const dataDate = new Date(today.getFullYear(), today.getMonth() - 5 + aggregatedData.indexOf(data), 1);
            return dataDate.getMonth() === orderMonth && dataDate.getFullYear() === orderYear;
          });

          if (monthIndex > -1) {
            aggregatedData[monthIndex].Total += order.total;
          }
        });

        setData(aggregatedData);
      } catch (error) {
        console.error("Erreur lors de la récupération des données :", error);
      }
    };

    fetchData();
  }, []);

  return <Chart data={data} aspect={aspect} title={title} />;
};

export default ChartContainer;
