"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const barColors = ["#38bdf8", "#0ea5e9", "#818cf8", "#34d399", "#fb923c"];
const pieColors = ["#38bdf8", "#ef4444", "#f97316", "#facc15", "#7c3aed"];

export function LineBox({data}:{data:{name:string,value:number}[]}){
  return <div className="h-64">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 16, right: 18, bottom: 6, left: 0 }}>
        <CartesianGrid stroke="#dff1fb" vertical={false}/>
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#54708d" }} axisLine={false} tickLine={false}/>
        <YAxis hide domain={["dataMin - 20", "dataMax + 20"]}/>
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #d9edf7" }}/>
        <Line type="monotone" dataKey="value" stroke="#21b5f5" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 6 }}/>
      </LineChart>
    </ResponsiveContainer>
  </div>
}

export function BarBox({data}:{data:{name:string,value:number}[]}){
  return <div className="h-64">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 24, right: 12, bottom: 0, left: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#54708d" }} axisLine={false} tickLine={false}/>
        <YAxis hide/>
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #d9edf7" }}/>
        <Bar dataKey="value" radius={[7,7,0,0]}>
          {data.map((_, index) => <Cell key={index} fill={barColors[index % barColors.length]}/>)}
          <LabelList dataKey="value" position="top" fill="#0b234f" fontSize={11} fontWeight={800}/>
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
}

export function DonutBox({data, center = "1247"}:{data:{name:string,value:number}[]; center?: string}){
  return <div className="h-64">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #d9edf7" }}/>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={94} paddingAngle={0}>
          {data.map((_, index) => <Cell key={index} fill={pieColors[index % pieColors.length]}/>)}
        </Pie>
        <text x="50%" y="49%" textAnchor="middle" dominantBaseline="middle" fill="#0b234f" fontSize="22" fontWeight="900">{center}</text>
      </PieChart>
    </ResponsiveContainer>
  </div>
}
