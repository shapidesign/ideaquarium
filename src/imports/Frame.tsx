import imgAsset11 from "figma:asset/027654ee2c5963d201cf5dc893bdeaebfc2844e3.png";

function NewIdea1() {
  return (
    <div className="bg-[#7cd4f6] content-stretch flex items-center justify-center px-[80px] py-[50px] relative rounded-[54.184px] shrink-0" data-name="New Idea">
      <div aria-hidden="true" className="absolute border-12 border-[#332085] border-solid inset-0 pointer-events-none rounded-[54.184px] shadow-[20px_14px_4px_0px_rgba(0,0,0,0.25)]" />
      <div className="flex flex-col font-['Shimshon','Miriam_Libre',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[119.204px] text-black text-center whitespace-nowrap">
        <p className="leading-[normal]" dir="auto">
          רעיון חדש
        </p>
      </div>
    </div>
  );
}

function NewIdea() {
  return (
    <div className="-translate-x-1/2 absolute content-stretch flex items-start left-[calc(50%-0.5px)] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] top-[1952px]" data-name="New Idea">
      <NewIdea1 />
    </div>
  );
}

export default function Frame() {
  return (
    <div className="relative size-full" data-name="Frame">
      <div className="absolute h-[2305px] left-0 top-0 w-[4096px]" data-name="Asset 1 1">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgAsset11} />
      </div>
      <NewIdea />
    </div>
  );
}
