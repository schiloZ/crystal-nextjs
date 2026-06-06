import type { Config } from "tailwindcss";
const config: Config = {content:["./app/**/*.{ts,tsx}","./components/**/*.{ts,tsx}"],theme:{extend:{colors:{navy:'#1b3a6b',sky:'#13aee8',soft:'#eef8fc',danger:'#e63746',ok:'#08956b',warning:'#d98a00'},boxShadow:{soft:'0 14px 40px rgba(6,36,90,.08)'}}},plugins:[]}; export default config;
