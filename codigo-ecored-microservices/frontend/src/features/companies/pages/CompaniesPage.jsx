import { useState } from "react";
import AlertMessage from "../../../shared/components/AlertMessage.jsx";
import PageHeader from "../../../shared/components/PageHeader.jsx";
import { getErrorMessage } from "../../../shared/utils/getErrorMessage.js";
import CompanyForm from "../components/CompanyForm.jsx";
import { createCompany } from "../services/companyService.js";

/**
 * Página contenedora del módulo de empresas.
 *
 * La página coordina el caso de uso y los mensajes; CompanyForm se concentra en
 * la interacción del usuario y companyService en la llamada HTTP.
 */
export default function CompaniesPage() {
  const [feedback, setFeedback] = useState(null);

  const handleCreateCompany = async (company) => {
    setFeedback(null);

    try {
      await createCompany(company);
      setFeedback({
        type: "success",
        message: "Empresa creada correctamente.",
      });
    } catch (error) {
      setFeedback({
        type: "danger",
        message: getErrorMessage(error, "No fue posible crear la empresa."),
      });
      throw error;
    }
  };

  return (
    <section aria-labelledby="companies-title">
      <PageHeader
        id="companies-title"
        title="Empresas"
        subtitle="Registra la información básica de una empresa."
      />

      <div className="row justify-content-center">
        <div className="col-lg-8">
          <AlertMessage type={feedback?.type} message={feedback?.message} />

          <article className="card shadow-sm">
            <div className="card-body p-4">
              <CompanyForm onSubmit={handleCreateCompany} />
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
