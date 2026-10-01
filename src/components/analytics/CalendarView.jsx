import DayDetail from "./DayDetail";
import { useState } from "react";
import DashboardReferenceCalendar from "../dashboard/DashboardReferenceCalendar";
function CalendarView({trades,s,checklist,theme,onLoadImages}) {
  const [selectedDay,setSelectedDay]=useState(null);

  return (
    <div
  className={`calendar-view ${theme === "dark" ? "calendar-dark" : "calendar-light"}`}
  style={{padding:"1.5rem",overflowY:"auto",maxHeight:"100vh"}}
>
      <DashboardReferenceCalendar trades={trades} onDayClick={setSelectedDay}/>
      {selectedDay&&<DayDetail date={selectedDay} trades={trades} onClose={()=>setSelectedDay(null)} s={s} checklist={checklist} onLoadImages={onLoadImages}/>}
    </div>
  );
}

// ── Apex Dashboard ────────────────────────────────────────────


export default CalendarView;
