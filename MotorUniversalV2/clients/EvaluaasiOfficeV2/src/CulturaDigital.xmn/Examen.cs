using System;
using System.CodeDom.Compiler;
using System.ComponentModel;
using System.Diagnostics;
using System.Xml.Serialization;

namespace CulturaDigital.xmn;

[Serializable]
[GeneratedCode("System.Xml", "4.7.3056.0")]
[DebuggerStepThrough]
[DesignerCategory("code")]
[XmlType(Namespace = "https://srvcsvls7-1.azurewebsites.net")]
public class Examen : INotifyPropertyChanged
{
	private int idField;

	private string nombreField;

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

	public event PropertyChangedEventHandler PropertyChanged;

	protected void RaisePropertyChanged(string propertyName)
	{
		this.PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
	}
}
