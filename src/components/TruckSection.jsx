import './truck-section.css';

export default function TruckSection({ mileage }) {
  return <section className="truck-section section-pad" id="truck" aria-labelledby="truck-title">
    <div className="truck-gallery"><div className="truck-gallery-viewport">
      <img className="truck-gallery-image is-active" src={`${import.meta.env.BASE_URL}images/truck/front.webp`} alt="Синий Volvo VNL 860" />
      <div className="truck-gallery-shade" aria-hidden="true" />
      <div className="wrap truck-gallery-title"><h2 id="truck-title">Наш Volvo<br /><span>VNL 860.</span></h2></div>
    </div></div>
    <div className="wrap"><dl className="truck-facts">
      <div><dt>Модель</dt><dd>Volvo VNL 860</dd></div>
      <div><dt>Год покупки</dt><dd>2022</dd></div>
      <div><dt>Пробег на {new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${mileage.asOf}T12:00:00Z`)).replace(' г.', '')}</dt><dd>{new Intl.NumberFormat('ru-RU').format(mileage.miles)} миль</dd></div>
    </dl></div>
  </section>;
}
