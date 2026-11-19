import instagramIcon from '@iconify-icons/bxl/instagram';
import linkIcon from '@iconify-icons/bx/link-external';
import '../person-dialog.css';

const stories = {
  anya: {
    photo: 'images/creators/anya.jpg',
    alt: 'Аня у воды',
    caption: 'Аня',
    role: 'Видео, дорога и дом',
    intro: 'Я снимаю и монтирую наши поездки. В рейсе помогаю с навигацией, а перед выездом готовлю домашнюю еду. Камера, навигатор и контейнеры с едой — мой обычный набор.',
    details: [
      ['В дороге', 'Прокладываю маршрут, занимаюсь делами в рейсе и сменяю Сергея за рулём.'],
      ['В кадре', 'Снимаю и монтирую видео, чтобы вы могли поехать с нами хотя бы на экране.'],
      ['Дома', 'Между рейсами занимаюсь домом и растениями во дворе.'],
    ],
  },
  sergey: {
    photo: 'images/creators/sergey.jpg',
    alt: 'Сергей у воды',
    caption: 'Сергей',
    role: 'Руль, техника и дом',
    intro: 'Я чаще за рулём, слежу за траком и люблю возиться с техникой. Дома тоже находятся дела: стройка, сад и гараж — без инструмента скучно.',
    details: [
      ['В дороге', 'Работаю за рулём и слежу за состоянием трака.'],
      ['В гараже', 'Люблю технику и проекты, где можно что-нибудь починить своими руками.'],
      ['Дома', 'Занимаюсь стройкой и садом между рейсами.'],
    ],
  },
};

function Icon({ icon }) {
  return <svg className="box-icon" viewBox={`0 0 ${icon.width || 24} ${icon.height || 24}`} aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: icon.body }} />;
}

export default function PersonDialog({ person, personKey }) {
  const story = stories[personKey];
  if (!person || !story) return null;

  return <div className={`person-profile person-profile--spread person-profile--${personKey}`}>
    <div className="person-profile-layout">
      <figure className="person-profile-photo">
        <img src={`${import.meta.env.BASE_URL}${story.photo}`} alt={story.alt} />
        <figcaption>{story.caption}</figcaption>
      </figure>
      <div className="person-profile-intro">
        <span className="person-profile-greeting">Привет, я</span>
        <h2 id="dialog-title">{person.name}</h2>
        <p className="person-profile-role">{story.role}</p>
        <p className="person-profile-description">{story.intro}</p>
      </div>
      <div className="person-profile-details">
        <h3>Чем я занимаюсь</h3>
        <dl>{story.details.map(([title, description]) => <div key={title}><dt>{title}</dt><dd>{description}</dd></div>)}</dl>
      </div>
    </div>

    <div className="person-profile-social">
      <span>Больше фотографий и новостей</span>
      <a href={person.social} target="_blank" rel="noopener noreferrer" aria-label={`Открыть Instagram ${personKey === 'anya' ? 'Ани' : 'Сергея'}: ${person.handle}`}>
        <Icon icon={instagramIcon} /> <span>Instagram · {person.handle}</span> <Icon icon={linkIcon} />
      </a>
    </div>
  </div>;
}
