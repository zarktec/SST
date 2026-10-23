-- Una versión PUBLICADA (o retirada) es inmutable: ni sus elementos ni sus datos se modifican.
-- Las únicas transiciones permitidas son: borrador → publicada y publicada → retirada (con effective_to).
CREATE OR REPLACE FUNCTION catalog_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_status catalog_status;
BEGIN
  SELECT status INTO v_status FROM catalog_version WHERE id = COALESCE(NEW.version_id, OLD.version_id);
  -- v_status nulo = la versión se está eliminando en cascada (solo posible si era borrador).
  IF v_status IS NOT NULL AND v_status <> 'draft' THEN
    RAISE EXCEPTION 'La versión del catálogo está publicada y no se puede modificar; crea un borrador nuevo';
  END IF;
  RETURN COALESCE(NEW, OLD);
END
$$;
--> statement-breakpoint
CREATE TRIGGER catalog_item_immutable BEFORE INSERT OR UPDATE OR DELETE ON catalog_item
  FOR EACH ROW EXECUTE FUNCTION catalog_item_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION catalog_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Una versión publicada no se puede eliminar';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'published' AND NEW.status = 'published' AND (NEW.catalog, NEW.version, NEW.effective_from, NEW.source_norm, NEW.notes) IS DISTINCT FROM (OLD.catalog, OLD.version, OLD.effective_from, OLD.source_norm, OLD.notes) THEN
    RAISE EXCEPTION 'Una versión publicada no se puede modificar';
  END IF;
  IF OLD.status = 'retired' AND NEW.status <> 'retired' THEN
    RAISE EXCEPTION 'Una versión retirada no se puede reabrir';
  END IF;
  IF OLD.status = 'published' AND NEW.status = 'draft' THEN
    RAISE EXCEPTION 'Una versión publicada no vuelve a borrador';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER catalog_version_guard_trg BEFORE UPDATE OR DELETE ON catalog_version
  FOR EACH ROW EXECUTE FUNCTION catalog_version_guard();
