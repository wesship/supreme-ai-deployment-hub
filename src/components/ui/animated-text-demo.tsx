
import React from "react";
import { AnimatedText } from "@/components/ui/animated-shiny-text";

function AnimatedTextDemo() {
  return (
    <AnimatedText
      text="d3vonn.io"
      gradientColors="linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6)"
      gradientAnimationDuration={3}
      hoverEffect={true}
      textClassName="text-[4rem] md:text-[6rem] font-bold"
    />
  );
}

export { AnimatedTextDemo };
