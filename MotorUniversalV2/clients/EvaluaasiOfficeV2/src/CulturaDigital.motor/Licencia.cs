using System;
using System.CodeDom.Compiler;
using System.ComponentModel;
using System.Diagnostics;
using System.Xml.Serialization;

namespace CulturaDigital.motor;

[Serializable]
[GeneratedCode("System.Xml", "4.7.3056.0")]
[DebuggerStepThrough]
[DesignerCategory("code")]
[XmlType(Namespace = "https://srvcsvls7-1.azurewebsites.net")]
public class Licencia : INotifyPropertyChanged
{
	private int idField;

	private string nombreField;

	private string nombreLicenciaField;

	private string nombreArchivoField;

	private string letraField;

	[XmlElement(Order = 0)]
	public int Id
	{
		get
		{
			return idField;
		}
		set
		{
			idField = value;
			RaisePropertyChanged("Id");
		}
	}

	[XmlElement(Order = 1)]
	public string Nombre
	{
		get
		{
			return nombreField;
		}
		set
		{
			nombreField = value;
			RaisePropertyChanged("Nombre");
		}
	}

	[XmlElement(Order = 2)]
	public string NombreLicencia
	{
		get
		{
			return nombreLicenciaField;
		}
		set
		{
			nombreLicenciaField = value;
			RaisePropertyChanged("NombreLicencia");
		}
	}

	[XmlElement(Order = 3)]
	public string NombreArchivo
	{
		get
		{
			return nombreArchivoField;
		}
		set
		{
			nombreArchivoField = value;
			RaisePropertyChanged("NombreArchivo");
		}
	}

	[XmlElement(Order = 4)]
	public string Letra
	{
		get
		{
			return letraField;
		}
		set
		{
			letraField = value;
			RaisePropertyChanged("Letra");
		}
	}

	public event PropertyChangedEventHandler PropertyChanged;

	protected void RaisePropertyChanged(string propertyName)
	{
		this.PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
	}
}
