using System;
using System.Collections.Generic;

namespace CulturaDigital.Models;

[Serializable]
public class Offline
{
	public List<Aplicacion> Aplicaciones { get; set; }

	public List<Usuario> Usuarios { get; set; }
}
