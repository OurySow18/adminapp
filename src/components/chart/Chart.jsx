/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * Die Statistiken für sechs letze Monaten werden hier angezeigt
 */
import "./chart.scss"
import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const X_AXIS_DEFAULTS = {
  allowDecimals: true,
  hide: false,
  orientation: "bottom",
  width: 0,
  height: 30,
  mirror: false,
  xAxisId: 0,
  tickCount: 5,
  type: "category",
  allowDataOverflow: false,
  scale: "auto",
  reversed: false,
  allowDuplicatedCategory: true,
};

const Y_AXIS_DEFAULTS = {
  allowDuplicatedCategory: true,
  allowDecimals: true,
  hide: false,
  orientation: "left",
  width: 60,
  height: 0,
  mirror: false,
  yAxisId: 0,
  tickCount: 5,
  type: "number",
  allowDataOverflow: false,
  scale: "auto",
  reversed: false,
};

if (XAxis?.defaultProps) {
  // React 18 warns about defaultProps on function components; we mirror needed defaults manually instead.
  XAxis.defaultProps = undefined;
}

if (YAxis?.defaultProps) {
  YAxis.defaultProps = undefined;
}

const getXAxisPadding = () => ({ left: 0, right: 0 });
const getYAxisPadding = () => ({ top: 0, bottom: 0 });

const dataMonth = [
    {name: "Janvier", Total: 1200},
    {name: "Fevrier", Total: 2500},
    {name: "Mars", Total: 800},
    {name: "Avril", Total: 1600},
    {name: "Mai", Total: 900},
    {name: "Juin", Total: 1700},
    {name: "Juillet", Total: 1800},
    {name: "Aoüt", Total: 1900},
    {name: "Septembre", Total: 2100},
    {name: "Octobre", Total: 2000},
    {name: "Novembre", Total: 2400},
    {name: "Decembre", Total: 2600},
];

const Chart = ({aspect, title}) => {  
  const [data, setData] = useState();

  useEffect(() => {
    const fetchData = async () => {
      const today = new Date();
      const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1);

      const q = query(
        collection(db, "orders"),
        where("timeStamp", ">=", sixMonthsAgo),
        where("timeStamp", "<=", today), 
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
        console.log(data)
  return (
    <div className="chart" >
        <div className="title">{title}</div>
      <ResponsiveContainer width="100%" aspect={aspect} >
        <AreaChart width={730} height={250} data={data}
            margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
            <defs>
                <linearGradient id="total" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                </linearGradient>               
            </defs>
            <XAxis
              {...X_AXIS_DEFAULTS}
              padding={getXAxisPadding()}
              dataKey="name"
              stroke="gray"
            />
            <YAxis
              {...Y_AXIS_DEFAULTS}
              padding={getYAxisPadding()}
            />
            <CartesianGrid strokeDasharray="3 3" className="chartGrid" />
            <Tooltip />
            <Area type="monotone" dataKey="Total" stroke="#8884d8" fillOpacity={1} fill="url(#total)" /> 
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default Chart
