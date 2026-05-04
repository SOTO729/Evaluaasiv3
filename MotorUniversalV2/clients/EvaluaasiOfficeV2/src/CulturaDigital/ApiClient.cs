using System;
using System.Collections.Generic;
using System.Configuration;
using System.IO;
using System.Net;
using System.Reflection;
using System.Runtime.Serialization.Json;
using System.Text;
using System.Web.Script.Serialization;

namespace CulturaDigital
{
    /// <summary>
    /// Cliente HTTP compartido para el backend MotorV2.
    /// Reemplaza la dependencia WCF/SOAP del binario legacy.
    /// </summary>
    internal static class ApiClient
    {
        private static readonly object _lock = new object();
        private static string _baseUrl;
        private static string _token;
        private static string _currentUsername;
        private static int _timeoutMs = 60000;

        public static string BaseUrl
        {
            get
            {
                if (_baseUrl == null)
                {
                    _baseUrl = (ConfigurationManager.AppSettings["MotorV2.BaseUrl"] ?? "")
                        .TrimEnd('/');
                    var t = ConfigurationManager.AppSettings["MotorV2.TimeoutSeconds"];
                    if (!string.IsNullOrEmpty(t)) int.TryParse(t, out _timeoutMs);
                    _timeoutMs *= 1000;
                    if (_timeoutMs < 5000) _timeoutMs = 60000;
                }
                return _baseUrl;
            }
        }

        public static string Token
        {
            get { lock (_lock) { return _token; } }
            set { lock (_lock) { _token = value; } }
        }

        public static string CurrentUsername
        {
            get { lock (_lock) { return _currentUsername; } }
            set { lock (_lock) { _currentUsername = value; } }
        }

        private static string _currentResultId;
        public static string CurrentResultId
        {
            get { lock (_lock) { return _currentResultId; } }
            set { lock (_lock) { _currentResultId = value; } }
        }

        static ApiClient()
        {
            // TLS 1.2 obligatorio para Container Apps
            try
            {
                ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls;
            }
            catch { /* runtime puede no soportarlo */ }
            ServicePointManager.Expect100Continue = false;
            ServicePointManager.DefaultConnectionLimit = 16;
        }

        public static IDictionary<string, object> Post(string path, IDictionary<string, object> body)
        {
            return Request("POST", path, body);
        }

        public static IDictionary<string, object> Get(string path)
        {
            return Request("GET", path, null);
        }

        public static string GetRaw(string path)
        {
            var req = BuildRequest("GET", path);
            using (var resp = (HttpWebResponse)req.GetResponse())
            using (var s = resp.GetResponseStream())
            using (var sr = new StreamReader(s, Encoding.UTF8))
            {
                return sr.ReadToEnd();
            }
        }

        private static HttpWebRequest BuildRequest(string method, string path)
        {
            var url = BaseUrl + (path.StartsWith("/") ? path : "/" + path);
            var req = (HttpWebRequest)WebRequest.Create(url);
            req.Method = method;
            req.Timeout = _timeoutMs;
            req.ReadWriteTimeout = _timeoutMs;
            req.Accept = "application/json";
            req.UserAgent = "EvaluaasiOfficeV2/" + (Assembly.GetEntryAssembly()?.GetName().Version?.ToString() ?? "2.0.0");
            var tok = Token;
            if (!string.IsNullOrEmpty(tok))
            {
                req.Headers["X-VB6-Token"] = tok;
                req.Headers["Authorization"] = "Bearer " + tok;
            }
            return req;
        }

        private static IDictionary<string, object> Request(string method, string path, IDictionary<string, object> body)
        {
            var req = BuildRequest(method, path);
            if (body != null)
            {
                req.ContentType = "application/json; charset=utf-8";
                var serializer = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
                var json = serializer.Serialize(body);
                var data = Encoding.UTF8.GetBytes(json);
                req.ContentLength = data.Length;
                using (var s = req.GetRequestStream())
                    s.Write(data, 0, data.Length);
            }

            string responseBody;
            HttpStatusCode status;
            try
            {
                using (var resp = (HttpWebResponse)req.GetResponse())
                using (var s = resp.GetResponseStream())
                using (var sr = new StreamReader(s, Encoding.UTF8))
                {
                    status = resp.StatusCode;
                    responseBody = sr.ReadToEnd();
                }
            }
            catch (WebException wex)
            {
                if (wex.Response is HttpWebResponse errResp)
                {
                    using (var s = errResp.GetResponseStream())
                    using (var sr = new StreamReader(s ?? new MemoryStream(), Encoding.UTF8))
                        responseBody = sr.ReadToEnd();
                    status = errResp.StatusCode;
                }
                else
                {
                    throw;
                }
            }

            if (string.IsNullOrEmpty(responseBody))
                return new Dictionary<string, object> { { "success", false }, { "error", "respuesta vacía" }, { "_status", (int)status } };

            try
            {
                var serializer = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
                var obj = serializer.Deserialize<IDictionary<string, object>>(responseBody);
                if (obj == null) obj = new Dictionary<string, object>();
                obj["_status"] = (int)status;
                return obj;
            }
            catch
            {
                return new Dictionary<string, object>
                {
                    { "success", false },
                    { "error", responseBody },
                    { "_status", (int)status }
                };
            }
        }

        public static T GetValue<T>(IDictionary<string, object> dict, string key, T defaultValue = default(T))
        {
            if (dict == null || !dict.ContainsKey(key) || dict[key] == null)
                return defaultValue;
            try
            {
                var raw = dict[key];
                if (raw is T t) return t;
                return (T)Convert.ChangeType(raw, typeof(T));
            }
            catch
            {
                return defaultValue;
            }
        }
    }
}
