using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;

namespace CulturaDigital.xmn
{
    /// <summary>
    /// Cliente Usuario refactorizado.
    /// Implementa <see cref="UsuarioSoap"/> sobre HTTP+JSON contra el backend MotorV2.
    /// El contrato público (firmas y forma del DataTable retornado) se conserva idéntico
    /// para no requerir cambios en Forms/Models/Helpers.
    /// </summary>
    public class UsuarioSoapClient : UsuarioSoap, IDisposable
    {
        public UsuarioSoapClient() { }
        public UsuarioSoapClient(string endpointConfigurationName) { }
        public UsuarioSoapClient(string endpointConfigurationName, string remoteAddress) { }

        public void Dispose() { /* HttpClient is static + disposable per request */ }

        // ─────────── LOGIN (5 variantes — todas mapean al mismo endpoint REST) ───────────

        public DataTable Login(string UsuarioNombre, string Password, int AppId, string VersionOffice, string VersionAplicacion)
            => LoginInternal(UsuarioNombre, Password, AppId, VersionOffice, VersionAplicacion, "examen");

        public DataTable LoginTest(string UsuarioNombre, string Password, int AppId, string VersionOffice, string VersionAplicacion)
            => LoginInternal(UsuarioNombre, Password, AppId, VersionOffice, VersionAplicacion, "examen", isTest: true);

        public DataTable LoginV2(string UsuarioNombre, string Password, int AppId, string VersionOffice, string VersionAplicacion)
            => LoginInternal(UsuarioNombre, Password, AppId, VersionOffice, VersionAplicacion, "examen");

        public DataTable LoginDiscapacidadVisual(string usuarioNombre, string password, int appId, string versionOffice, string versionAplicacion)
            => LoginInternal(usuarioNombre, password, appId, versionOffice, versionAplicacion, "examen", accesibilidad: true);

        private DataTable LoginInternal(string username, string password, int appId, string versionOffice, string versionApp, string mode, bool isTest = false, bool accesibilidad = false)
        {
            var body = new Dictionary<string, object>
            {
                { "username", username },
                { "password", password },
                { "mode", mode },
                { "office_version", versionOffice },
                { "app_version", versionApp },
                { "is_test", isTest },
                { "accesibilidad", accesibilidad },
                { "office_app_id", appId },
            };

            var resp = ApiClient.Post("/vb6/login", body);

            // Cachear token VB6 para los siguientes calls (Inicio/Fin/Storage)
            var token = ApiClient.GetValue<string>(resp, "token");
            if (!string.IsNullOrEmpty(token)) ApiClient.Token = token;

            // Cachear username (puede venir como "username" o ser el de entrada) para
            // endpoints que lo requieren como query (p.ej. /standards/available).
            var respUsername = ApiClient.GetValue<string>(resp, "username", username);
            if (!string.IsNullOrEmpty(respUsername)) ApiClient.CurrentUsername = respUsername;

            // Construir DataTable con la forma que Usuario(DataRow) y Aplicacion(DataRow) esperan
            // Mapeo derivado del código decompilado:
            // [0]=UsuarioId  [1]=Nombre  [2]=Apellido  [3]=VoucherId  [4]=VoucherCode
            // [5]=AplicacionId  [6]=Prioritaria  [7]=URL  [8]=bLogin  [9]=detalleExamen
            // [10]=SubSistema  [11]=(reservado)  [12]=PerfilId  [13]=Plantel  [14]=Grupo
            // [15]=UsuarioEmail  [16]=MostrarAviso  [17]=Aviso  [18]=CURP
            // [19]=SubSistemaId  [20]=Perfil  [21]=URLAviso  [22]=(reservado)
            // [23]=PinSeguridad  [24]=PIN
            var dt = NewLoginTable();
            bool success = ApiClient.GetValue<bool>(resp, "success");
            string errorMsg = ApiClient.GetValue<string>(resp, "error", "");

            if (!success)
            {
                // Devolver una fila con bLogin=false para que el Form muestre el mensaje
                var row = dt.NewRow();
                FillRowFromDefaults(row);
                row[8] = false;
                row[9] = string.IsNullOrEmpty(errorMsg) ? "Credenciales inválidas" : errorMsg;
                dt.Rows.Add(row);
                return dt;
            }

            int userId = ApiClient.GetValue<int>(resp, "user_id");
            string fullName = ApiClient.GetValue<string>(resp, "full_name", "");
            string nombre = fullName, apellido = "";
            if (!string.IsNullOrEmpty(fullName) && fullName.Contains(" "))
            {
                var parts = fullName.Split(new[] { ' ' }, 2);
                nombre = parts[0];
                apellido = parts[1];
            }

            int campusId = ApiClient.GetValue<int>(resp, "campus_id");
            int groupId = ApiClient.GetValue<int>(resp, "group_id");
            string usernameOut = ApiClient.GetValue<string>(resp, "username", "");
            var config = resp.ContainsKey("config") ? resp["config"] as IDictionary<string, object> : null;
            string urlExamenZip = ApiClient.GetValue<string>(config, "exam_xae_url", "");
            int prioritaria = ApiClient.GetValue<int>(config, "prioritaria", 1);

            var rowOk = dt.NewRow();
            FillRowFromDefaults(rowOk);
            rowOk[0] = userId;                    // UsuarioId
            rowOk[1] = nombre;                    // Nombre
            rowOk[2] = apellido;                  // Apellido
            rowOk[3] = userId;                    // VoucherId (usamos user_id como surrogate)
            rowOk[4] = string.Format("VCH{0:D5}1{1:D8}", appId, userId); // VoucherCode 14 chars con NoOportunidad en pos 8
            rowOk[5] = appId > 0 ? appId : 1;     // AplicacionId
            rowOk[6] = prioritaria;                // Prioritaria
            rowOk[7] = urlExamenZip ?? "";         // URL del XAE
            rowOk[8] = true;                       // bLogin
            rowOk[9] = "";                         // detalleExamen (sin error)
            rowOk[10] = "";                        // SubSistema (string)
            rowOk[11] = "";                        // reservado
            rowOk[12] = 0;                         // PerfilId
            rowOk[13] = "";                        // Plantel (nombre)
            rowOk[14] = string.Format("Grupo {0}", groupId); // Grupo
            rowOk[15] = usernameOut;               // UsuarioEmail
            rowOk[16] = 0;                         // MostrarAviso
            rowOk[17] = 1;                         // Aviso
            rowOk[18] = "";                        // CURP
            rowOk[19] = campusId;                  // SubSistemaId (usamos campus_id)
            rowOk[20] = "Candidato";               // Perfil
            rowOk[21] = "";                        // URLAviso
            rowOk[22] = "";                        // reservado
            rowOk[23] = false;                     // PinSeguridad
            rowOk[24] = "";                        // PIN
            dt.Rows.Add(rowOk);
            return dt;
        }

        private static DataTable NewLoginTable()
        {
            var dt = new DataTable("LoginResponse");
            for (int i = 0; i < 25; i++) dt.Columns.Add("c" + i, typeof(object));
            return dt;
        }

        private static void FillRowFromDefaults(DataRow row)
        {
            // Defaults numéricos = 0, strings = "", bools = false
            row[0] = 0;
            row[1] = "";
            row[2] = "";
            row[3] = 0;
            row[4] = "";
            row[5] = 0;
            row[6] = 0;
            row[7] = "";
            row[8] = false;
            row[9] = "";
            row[10] = "";
            row[11] = "";
            row[12] = 0;
            row[13] = "";
            row[14] = "";
            row[15] = "";
            row[16] = 0;
            row[17] = 0;
            row[18] = "";
            row[19] = 0;
            row[20] = "";
            row[21] = "";
            row[22] = "";
            row[23] = false;
            row[24] = "";
        }

        // ─────────── INICIO / FIN ───────────

        public DataTable Inicio(int VoucherId, string UserPC, string NombrePC, string IP, string MAC, string VersionExamen, string VersionApp, string Subsistema, int AvisoPrivacidad)
            => InicioInternal(VoucherId, UserPC, NombrePC, IP, MAC, VersionExamen, VersionApp, Subsistema, AvisoPrivacidad);

        public DataTable InicioTest(int VoucherId, string UserPC, string NombrePC, string IP, string MAC, string VersionExamen, string VersionApp, string Subsistema, int AvisoPrivacidad)
            => InicioInternal(VoucherId, UserPC, NombrePC, IP, MAC, VersionExamen, VersionApp, Subsistema, AvisoPrivacidad);

        private DataTable InicioInternal(int voucherId, string userPC, string pc, string ip, string mac, string versionExamen, string versionApp, string subsistema, int avisoPrivacidad)
        {
            var body = new Dictionary<string, object>
            {
                { "session_type", "examen" },
                { "office_app", "excel" },
                { "voucher_code", voucherId.ToString() },
                { "ip", ip },
                { "mac", mac },
                { "pc_name", pc },
                { "user_pc", userPC },
                { "office_version", versionExamen },
                { "app_version", versionApp },
                { "aviso_privacidad", avisoPrivacidad },
            };
            var resp = ApiClient.Post("/vb6/start", body);
            bool ok = ApiClient.GetValue<bool>(resp, "success");

            // Cachear result_id (UUID) devuelto por backend; /vb6/finish lo necesita.
            var resultIdResp = ApiClient.GetValue<string>(resp, "result_id", "");
            if (!string.IsNullOrEmpty(resultIdResp)) ApiClient.CurrentResultId = resultIdResp;

            // Forms.CulturaDigital_Inicio lee Rows[0][0] como int — 0 = OK, distinto de 0 = error
            var dt = new DataTable("InicioResponse");
            dt.Columns.Add("c0", typeof(object));
            dt.Columns.Add("c1", typeof(object));
            var row = dt.NewRow();
            row[0] = ok ? 0 : 1;
            row[1] = resultIdResp;
            dt.Rows.Add(row);
            return dt;
        }

        public DataTable Fin(int VoucherId, int Resultado, int Escenario, string Subsistema)
            => FinInternal(VoucherId, Resultado, Escenario, Subsistema);

        public DataTable FinTest(int VoucherId, int Resultado, int Escenario, string Subsistema)
            => FinInternal(VoucherId, Resultado, Escenario, Subsistema);

        private DataTable FinInternal(int voucherId, int resultado, int escenario, string subsistema)
        {
            // El backend /vb6/finish requiere result_id (UUID) — lo cacheamos en Inicio.
            // El parámetro voucherId queda como fallback sólo si no hay result_id cacheado.
            var resultIdStr = ApiClient.CurrentResultId;
            if (string.IsNullOrEmpty(resultIdStr)) resultIdStr = voucherId.ToString();

            var body = new Dictionary<string, object>
            {
                { "result_id", resultIdStr },
                { "score", resultado },
                { "escenario", escenario },
                { "subsistema", subsistema },
                { "expire_voucher", true },
            };
            var resp = ApiClient.Post("/vb6/finish", body);
            bool ok = ApiClient.GetValue<bool>(resp, "success");

            var dt = new DataTable("FinResponse");
            dt.Columns.Add("c0", typeof(object));
            dt.Columns.Add("c1", typeof(object));
            var row = dt.NewRow();
            row[0] = ok ? 0 : 1;
            row[1] = ApiClient.GetValue<string>(resp, "certificate_code", "");
            dt.Rows.Add(row);
            return dt;
        }

        public int CaducaVoucherPorPin(int VoucherId, string Subsistema)
        {
            // Compatibilidad fire-and-forget — el ciclo de vida del token VB6 lo maneja /vb6/finish
            return 0;
        }

        // ─────────── CATÁLOGOS ───────────

        public Examen[] Examenes(int subsistema, int plantel)
        {
            // Estrategia v2: usar /api/vb6/my-exams (auth X-VB6-Token) que retorna las
            // VmSessions agendadas y las opciones libres para el candidato autenticado.
            // Fallback: /api/standards/available?username=... (catálogo público) si no
            // hay token VB6 disponible o el endpoint retorna vacío.
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

            // Fallback al catálogo público
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
            // El backend retorna {success, xae_content_b64} o {success, xae_url}
            var resp = ApiClient.Get(string.Format("/exams/{0}/download-xae", AplicacionId));
            var dt = new DataTable("DescargarExamenResponse");
            dt.Columns.Add("c0", typeof(object));
            dt.Columns.Add("c1", typeof(object));
            var row = dt.NewRow();
            row[0] = AplicacionId;
            // El form lee Rows[0][1] como contenido XML del examen
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

        public double Fecha()
        {
            // OLE Automation date: días desde 1899-12-30
            var resp = ApiClient.Get("/health/server-time");
            var ole = ApiClient.GetValue<double>(resp, "ole_date", 0);
            if (ole > 0) return ole;
            return DateTime.UtcNow.ToOADate();
        }
    }
}
