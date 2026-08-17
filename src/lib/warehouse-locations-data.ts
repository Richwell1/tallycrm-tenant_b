import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type WarehouseLocationRow = Database["public"]["Tables"]["warehouse_locations"]["Row"];
export type WarehouseLocationInsert = Database["public"]["Tables"]["warehouse_locations"]["Insert"];
export type WarehouseLocationUpdate = Database["public"]["Tables"]["warehouse_locations"]["Update"];

export const warehouseLocationsKey = ["warehouse_locations"] as const;

export function useWarehouseLocations() {
  return useQuery({
    queryKey: warehouseLocationsKey,
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouse_locations").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as WarehouseLocationRow[];
    },
  });
}

interface SaveWarehouseLocationInput {
  id?: string;
  code: string;
  name: string;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  is_active: boolean;
}

export function useSaveWarehouseLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: SaveWarehouseLocationInput) => {
      const payload = {
        ...input,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
      };
      const result = id
        ? await supabase
            .from("warehouse_locations")
            .update(payload satisfies WarehouseLocationUpdate)
            .eq("id", id)
            .select("*")
            .single()
        : await supabase
            .from("warehouse_locations")
            .insert(payload satisfies WarehouseLocationInsert)
            .select("*")
            .single();
      if (result.error) throw result.error;
      return result.data as WarehouseLocationRow;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: warehouseLocationsKey }),
  });
}
