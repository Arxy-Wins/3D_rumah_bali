import {
  BorderSolidIcon,
  BoxIcon,
  CursorArrowIcon,
  FrameIcon,
  GlobeIcon,
  ImageIcon,
  LightningBoltIcon,
  ReloadIcon,
  Cross2Icon,
  HamburgerMenuIcon,
} from "@radix-ui/react-icons";
import React from "react";
import Tool from "./tool";
import * as Types from "@/types/types";

export default function Toolbar({
  toolSelected,
  toolDisabled,
  onSelect,
}: {
  toolSelected: Types.Tool | undefined | null;
  toolDisabled: (tool: Types.Tool) => boolean;
  onSelect: (tool: Types.Tool) => void;
}) {
  // ToolBox bisa disembunyikan supaya tidak menutupi model 3D; pilihan diingat di browser
  const [open, setOpen] = React.useState(true);
  React.useEffect(() => {
    try {
      if (localStorage.getItem("toolbox-open") === "0") setOpen(false);
    } catch {}
  }, []);
  const toggle = (v: boolean) => {
    setOpen(v);
    try {
      localStorage.setItem("toolbox-open", v ? "1" : "0");
    } catch {}
  };

  if (!open) {
    return (
      <button
        onClick={() => toggle(true)}
        title="Tampilkan ToolBox"
        className="static md:fixed z-10 left-4 top-4 flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium shadow-sm hover:bg-gray-100"
      >
        <HamburgerMenuIcon /> ToolBox
      </button>
    );
  }

  return (
    <div className="static md:fixed z-10 left-10 md:top-1/2 md:-translate-y-1/2 flex md:flex-col items-center justify-center gap-2">
      <div className="flex items-center gap-1">
        <p className="font-medium">ToolBox</p>
        <button onClick={() => toggle(false)} title="Sembunyikan ToolBox" className="rounded p-0.5 text-gray-500 hover:bg-gray-200">
          <Cross2Icon />
        </button>
      </div>
      <div className="flex md:flex-col gap-4 w-fit bg-white shadow-sm p-1 rounded-sm">
        <Tool
          icon={<CursorArrowIcon />}
          tooltip="Move"
          selected={toolSelected === "mouse"}
          disabled={toolDisabled("mouse")}
          onClick={() => onSelect("mouse")}
        />
        <Tool
          icon={<BoxIcon />}
          tooltip="Area"
          selected={toolSelected === "area"}
          disabled={toolDisabled("area")}
          onClick={() => onSelect("area")}
        />
        <Tool
          icon={<FrameIcon />}
          tooltip="Area"
          selected={toolSelected === "area-image"}
          disabled={toolDisabled("area-image")}
          onClick={() => onSelect("area-image")}
        />
        <Tool
          icon={<BorderSolidIcon />}
          tooltip="Street"
          selected={toolSelected === "street"}
          disabled={toolDisabled("street")}
          onClick={() => onSelect("street")}
        />
        <Tool
          icon={<ImageIcon />}
          tooltip="Image"
          selected={toolSelected === "image"}
          disabled={toolDisabled("image")}
          onClick={() => onSelect("image")}
        />
        <Tool
          icon={<GlobeIcon />}
          tooltip="Long Lat"
          selected={toolSelected === "long-lat"}
          disabled={toolDisabled("long-lat")}
          onClick={() => onSelect("long-lat")}
        />
        <Tool
          icon={<ReloadIcon />}
          tooltip="Clear"
          onClick={() => onSelect("clear")}
        />
      </div>
      <div className="flex flex-col gap-4 w-fit bg-white shadow-sm p-1 rounded-sm">
        <Tool
          icon={<LightningBoltIcon />}
          tooltip="Generate"
          onClick={() => onSelect("generate")}
        />
      </div>
    </div>
  );
}
