function Frame2() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0 w-full">
      <div className="flex flex-[1_0_0] flex-col font-['Shimshon','Miriam_Libre',sans-serif] justify-center leading-[0] min-h-px min-w-px not-italic relative text-[119.204px] text-black text-right">
        <p className="leading-[normal] whitespace-pre-wrap" dir="auto">
          שם הרעיון
        </p>
      </div>
    </div>
  );
}

function Frame() {
  return (
    <div className="content-stretch flex flex-col gap-[64px] items-end relative shrink-0 w-full">
      <Frame2 />
      <div className="bg-[#afddff] h-[208px] relative rounded-[63px] shrink-0 w-full">
        <div aria-hidden="true" className="absolute border-7 border-black border-solid inset-[-7px] pointer-events-none rounded-[70px]" />
      </div>
    </div>
  );
}

function Frame4() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0 w-full">
      <div className="flex flex-[1_0_0] flex-col font-['Shimshon','Miriam_Libre',sans-serif] justify-center leading-[0] min-h-px min-w-px not-italic relative text-[119.204px] text-black text-right">
        <p className="leading-[normal] whitespace-pre-wrap" dir="auto">
          תיאור
        </p>
      </div>
    </div>
  );
}

function Frame1() {
  return (
    <div className="content-stretch flex flex-col gap-[64px] items-end relative shrink-0 w-full">
      <Frame4 />
      <div className="bg-[#afddff] h-[1137px] relative rounded-[103px] shrink-0 w-full">
        <div aria-hidden="true" className="absolute border-7 border-black border-solid inset-[-7px] pointer-events-none rounded-[110px]" />
      </div>
    </div>
  );
}

function Query1() {
  return (
    <div className="content-stretch flex flex-col gap-[117px] items-start relative shrink-0 w-[2161px]" data-name="Query">
      <Frame />
      <Frame1 />
    </div>
  );
}

function Close1() {
  return (
    <div className="bg-[#ffe367] content-stretch flex items-center px-[60px] py-[50px] relative rounded-[54.184px] shrink-0" data-name="Close">
      <div className="flex flex-col font-['Shimshon','Miriam_Libre',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[119.204px] text-black text-center whitespace-nowrap">
        <p className="leading-[normal]" dir="auto">
          סגור
        </p>
      </div>
    </div>
  );
}

function Close() {
  return (
    <div className="content-stretch flex items-start relative shadow-[20px_14px_4px_0px_rgba(0,0,0,0.25)] shrink-0" data-name="Close">
      <Close1 />
    </div>
  );
}

function Delete1() {
  return (
    <div className="bg-[#ff6767] content-stretch flex items-center px-[60px] py-[50px] relative rounded-[54.184px] shrink-0" data-name="Delete">
      <div className="flex flex-col font-['Shimshon','Miriam_Libre',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[119.204px] text-black text-center whitespace-nowrap">
        <p className="leading-[normal]" dir="auto">
          מחיקה
        </p>
      </div>
    </div>
  );
}

function Delete() {
  return (
    <div className="content-stretch flex items-start relative shadow-[20px_14px_4px_0px_rgba(0,0,0,0.25)] shrink-0" data-name="Delete">
      <Delete1 />
    </div>
  );
}

function Save1() {
  return (
    <div className="bg-[#67f04c] content-stretch flex items-center px-[60px] py-[50px] relative rounded-[54.184px] shrink-0" data-name="Save">
      <div className="flex flex-col font-['Shimshon','Miriam_Libre',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[119.204px] text-black text-center whitespace-nowrap">
        <p className="leading-[normal]" dir="auto">
          שמור
        </p>
      </div>
    </div>
  );
}

function Save() {
  return (
    <div className="content-stretch flex items-start relative shadow-[20px_14px_4px_0px_rgba(0,0,0,0.25)] shrink-0" data-name="Save">
      <Save1 />
    </div>
  );
}

function Buttons() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-full" data-name="Buttons">
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex gap-[334px] items-center justify-center px-[30px] py-[260px] relative size-full">
          <Close />
          <Delete />
          <Save />
        </div>
      </div>
    </div>
  );
}

function Frame3() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[146px] items-start min-h-px min-w-px relative w-full">
      <Query1 />
      <Buttons />
    </div>
  );
}

export default function Query() {
  return (
    <div className="bg-[#d7eeff] content-stretch flex flex-col items-start px-[159px] py-[200px] relative rounded-[163px] size-full" data-name="Query">
      <Frame3 />
    </div>
  );
}
