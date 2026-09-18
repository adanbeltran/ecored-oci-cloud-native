import { useEffect, useState } from "react";
import { listCompanies } from "../../companies/services/companyService.js";
import AlertMessage from "../../../shared/components/AlertMessage.jsx";
import LoadingSpinner from "../../../shared/components/LoadingSpinner.jsx";
import PageHeader from "../../../shared/components/PageHeader.jsx";
import { getErrorMessage } from "../../../shared/utils/getErrorMessage.js";
import MaterialForm from "../components/MaterialForm.jsx";
import MaterialList from "../components/MaterialList.jsx";
import {
  createMaterial,
  listMaterials,
} from "../services/materialService.js";

/**
 * Página contenedora del módulo de materiales.
 *
 * Carga en paralelo las empresas y las publicaciones. AbortController evita
 * actualizar estado si el usuario abandona la ruta durante una petición.
 */
export default function MaterialsPage() {
  const [companies, setCompanies] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadInitialData = async () => {
      setLoading(true);
      setFeedback(null);

      try {
        const [companyData, materialData] = await Promise.all([
          listCompanies({ signal: controller.signal }),
          listMaterials({ signal: controller.signal }),
        ]);

        setCompanies(Array.isArray(companyData) ? companyData : []);
        setItems(Array.isArray(materialData) ? materialData : []);
      } catch (error) {
        if (error.code !== "ERR_CANCELED") {
          setFeedback({
            type: "danger",
            message: getErrorMessage(
              error,
              "No fue posible cargar empresas y materiales.",
            ),
          });
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadInitialData();
    return () => controller.abort();
  }, []);

  const handleCreateMaterial = async (material) => {
    setFeedback(null);

    try {
      await createMaterial(material);
      const refreshedItems = await listMaterials();
      setItems(Array.isArray(refreshedItems) ? refreshedItems : []);
      setFeedback({
        type: "success",
        message: "Publicación creada correctamente.",
      });
    } catch (error) {
      setFeedback({
        type: "danger",
        message: getErrorMessage(
          error,
          "No fue posible crear la publicación de material.",
        ),
      });
      throw error;
    }
  };

  return (
    <section aria-labelledby="materials-title">
      <PageHeader
        id="materials-title"
        title="Materiales"
        subtitle="Registra y consulta publicaciones asociadas a una empresa."
      />

      <AlertMessage type={feedback?.type} message={feedback?.message} />

      {loading ? (
        <LoadingSpinner label="Cargando información" />
      ) : (
        <div className="row g-4">
          <div className="col-lg-7">
            <article className="card shadow-sm h-100">
              <div className="card-body p-4">
                <h2 className="h5 mb-4">Nueva publicación</h2>
                <MaterialForm
                  companies={companies}
                  onSubmit={handleCreateMaterial}
                />
              </div>
            </article>
          </div>

          <div className="col-lg-5">
            <article className="card shadow-sm h-100">
              <div className="card-body p-4">
                <h2 className="h5 mb-3">Publicaciones registradas</h2>
                <MaterialList items={items} />
              </div>
            </article>
          </div>
        </div>
      )}
    </section>
  );
}
