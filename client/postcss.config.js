import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

const stripTextSizeAdjust = {
  postcssPlugin: "strip-text-size-adjust",
  Once(root) {
    root.walkDecls((decl) => {
      if (decl.prop === "text-size-adjust" || decl.prop === "-webkit-text-size-adjust") {
        decl.remove();
      }
    });
  }
};

export default {
  plugins: [tailwindcss(), autoprefixer(), stripTextSizeAdjust]
};
