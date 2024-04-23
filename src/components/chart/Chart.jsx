/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * Die Statistiken für sechs letze Monaten werden hier angezeigt
 */
import "./chart.scss"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
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
  return (
    <div className="chart" >
        <div className="title">{title}</div>
      <ResponsiveContainer width="100%" aspect={aspect} >
        <AreaChart width={730} height={250} data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
                <linearGradient id="total" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                </linearGradient>               
            </defs>
            <XAxis dataKey="name" stroke="gray" />
            <YAxis />
            <CartesianGrid strokeDasharray="3 3" className="chartGrid" />
            <Tooltip />
            <Area type="monotone" dataKey="Total" stroke="#8884d8" fillOpacity={1} fill="url(#total)" /> 
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default Chart