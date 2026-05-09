using System;
using System.Collections.Generic;
using System.Data;

namespace CulturaDigital.motor
{
    public class MotorUniversalSoapClient : MotorUniversalSoap, IDisposable
    {
        public MotorUniversalSoapClient() { }
        public MotorUniversalSoapClient(string endpointConfigurationName) { }

        public void Dispose() { }

        public Licencia[] Licencias(bool partner)
        {
            // Catálogo de licencias instalables (Excel/Word/PowerPoint en sus versiones)
            var resp = ApiClient.Get(string.Format("/standards?type=office_license&partner={0}", partner ? "true" : "false"));
            return ParseLicencias(resp);
        }

        public Licencia[] ExamenesDisponibles(string usuario)
        {
            var resp = ApiClient.Get(string.Format("/standards/available?username={0}", Uri.EscapeDataString(usuario ?? "")));
            return ParseLicencias(resp);
        }

        private static Licencia[] ParseLicencias(IDictionary<string, object> resp)
        {
            var list = new List<Licencia>();
            if (resp == null) return list.ToArray();
            object src;
            if (!resp.TryGetValue("items", out src)) resp.TryGetValue("licencias", out src);
            if (src is System.Collections.IEnumerable items)
            {
                foreach (var item in items)
                {
                    if (item is IDictionary<string, object> d)
                    {
                        list.Add(new Licencia
                        {
                            Id = ApiClient.GetValue<int>(d, "id"),
                            Nombre = ApiClient.GetValue<string>(d, "name", "") ?? "",
                            NombreLicencia = ApiClient.GetValue<string>(d, "license_name", "") ?? "",
                            NombreArchivo = ApiClient.GetValue<string>(d, "filename", "") ?? "",
                            Letra = ApiClient.GetValue<string>(d, "letter", "") ?? "",
                        });
                    }
                }
            }
            return list.ToArray();
        }

        public Examen[] Examenes(int subsistema, int plantel)
        {
            // Estrategia v2: usar /api/vb6/my-exams (auth X-VB6-Token) que retorna las
            // VmSessions agendadas y las opciones libres para el candidato autenticado.
            // Fallback: /api/standards/available?username=... si no hay token o vacío.
            var list = new List<Examen>();
            IDictionary<string, object> resp = null;

            if (!string.IsNullOrEmpty(ApiClient.Token))
            {
                try { resp = ApiClient.Get("/vb6/my-exams"); }
                catch { resp = null; }
            }

            object src = null;
            if (resp != null) resp.TryGetValue("items", out src);
            if (src is System.Collections.IEnumerable myItems)
            {
                foreach (var item in myItems)
                {
                    if (item is IDictionary<string, object> d)
                    {
                        list.Add(new Examen
                        {
                            Id = ApiClient.GetValue<int>(d, "id"),
                            Nombre = ApiClient.GetValue<string>(d, "name", "") ?? "",
                        });
                    }
                }
            }

            if (list.Count > 0) return list.ToArray();

            var user = ApiClient.CurrentUsername ?? "";
            if (string.IsNullOrEmpty(user)) return list.ToArray();
            resp = ApiClient.Get("/standards/available?username=" + Uri.EscapeDataString(user));
            if (resp == null) return list.ToArray();
            src = null;
            if (!resp.TryGetValue("items", out src))
            {
                if (!resp.TryGetValue("exams", out src))
                {
                    resp.TryGetValue("data", out src);
                }
            }
            if (src is System.Collections.IEnumerable items)
            {
                foreach (var item in items)
                {
                    if (item is IDictionary<string, object> d)
                    {
                        list.Add(new Examen
                        {
                            Id = ApiClient.GetValue<int>(d, "id"),
                            Nombre = ApiClient.GetValue<string>(d, "name", "") ?? ApiClient.GetValue<string>(d, "title", ""),
                        });
                    }
                }
            }
            return list.ToArray();
        }

        public DataTable DescargarExamen(int AplicacionId)
        {
            var resp = ApiClient.Get(string.Format("/exams/{0}/download-xae", AplicacionId));
            var dt = new DataTable("DescargarExamenResponse");
            dt.Columns.Add("c0", typeof(object));
            dt.Columns.Add("c1", typeof(object));
            var row = dt.NewRow();
            row[0] = AplicacionId;
            row[1] = ApiClient.GetValue<string>(resp, "xae_content", "")
                  ?? ApiClient.GetValue<string>(resp, "content", "")
                  ?? "";
            dt.Rows.Add(row);
            return dt;
        }

        public string VersionExamen(int aplicacion)
        {
            var resp = ApiClient.Get(string.Format("/downloads/office-apps/exam-version?app_id={0}", aplicacion));
            return ApiClient.GetValue<string>(resp, "version", "1.0.0");
        }

        public string VersionAplicacion(int tipo, bool produccion)
        {
            var appName = (tipo == 2) ? "EvaluaasiOfficeV2" : (tipo == 3) ? "SimuladorOfficeV2" : "ParcialesOfficeV2";
            var resp = ApiClient.Get(string.Format("/downloads/office-apps/version-check?app_name={0}&current_version=0.0.0", appName));
            return ApiClient.GetValue<string>(resp, "latest_version", "2.0.0");
        }
    }
}
