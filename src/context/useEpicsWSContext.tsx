import { createContext, useContext } from "react";
import type useEpicsWS from "./useEpicsWS";

export type EpicsWSContextType = ReturnType<typeof useEpicsWS>;

export const EpicsWSContext = createContext<EpicsWSContextType | undefined>(undefined);

export const useEpicsWSContext = () => {
  const ctx = useContext(EpicsWSContext);
  if (!ctx) throw new Error("EpicsWSContext not found");
  return ctx;
};
