import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Icon } from "../src/components/ui";

afterEach(cleanup);

// 아이콘은 선(stroke)만 그린다. fill을 넘기지 않으면 속을 비워야 한다(#148 뒤로 검게 채워졌다)
const svgFill = (el: HTMLElement) =>
  el.querySelector("svg")?.getAttribute("fill");

describe("아이콘", () => {
  it("채우기를 정하지 않으면 속을 비운다", () => {
    const { container } = render(<Icon name="search" />);
    expect(svgFill(container)).toBe("none");
  });

  it("채우기를 정하면 그 색으로 채운다(켜진 별)", () => {
    const { container } = render(<Icon name="star" fill="#F5B400" />);
    expect(svgFill(container)).toBe("#F5B400");
  });
});
