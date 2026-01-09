import { useQuery } from "@tanstack/react-query";

// Ensure this path matches the 'public' structure: public/plans/office_plan.svg
const SVG_PATH = "/plans/office_plan.svg";

export const usePlanSvg = () => {
    return useQuery({
        queryKey: ["plan-svg"],
        queryFn: async () => {
            const response = await fetch(SVG_PATH);
            if (!response.ok) {
                console.error("Failed to load SVG:", response.status);
                throw new Error("SVG Loading Failed");
            }
            return response.text();
        },
        staleTime: Infinity,
    });
};
