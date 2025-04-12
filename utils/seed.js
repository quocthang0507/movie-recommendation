async function seedNeo4j() {
  const session = driver.session();
  try {
    const [movies] = await db.query('SELECT * FROM Movies');
    const [users] = await db.query('SELECT * FROM Users');
    const [favorites] = await db.query('SELECT * FROM Favorites');
    const [genres] = await db.query('SELECT * FROM Genres');
    const [directors] = await db.query('SELECT * FROM Directors');

    await session.run('MATCH (n) DETACH DELETE n');

    for (const genre of genres) {
      await session.run(
        `MERGE (g:Genre {genreId: $genreId}) SET g.name = $name`,
        { genreId: genre.genre_id.toString(), name: genre.name }
      );
    }

    for (const director of directors) {
      await session.run(
        `MERGE (d:Director {directorId: $directorId}) SET d.name = $name`,
        { directorId: director.director_id.toString(), name: director.name }
      );
    }

    for (const movie of movies) {
      await session.run(
        `MERGE (m:Movie {movieId: $movieId}) SET m.title = $title, m.release_date = $release_date`,
        {
          movieId: movie.movie_id.toString(),
          title: movie.title,
          release_date: movie.release_date?.toISOString().split('T')[0] || null
        }
      );

      await session.run(
        `MATCH (m:Movie {movieId: $movieId}), (g:Genre {genreId: $genreId}) MERGE (m)-[:HAS_GENRE]->(g)`,
        { movieId: movie.movie_id.toString(), genreId: movie.genre_id.toString() }
      );

      await session.run(
        `MATCH (m:Movie {movieId: $movieId}), (d:Director {directorId: $directorId}) MERGE (m)-[:DIRECTED_BY]->(d)`,
        { movieId: movie.movie_id.toString(), directorId: movie.director_id.toString() }
      );
    }

    for (const user of users) {
      await session.run(
        `MERGE (u:User {userId: $userId}) SET u.username = $username`,
        { userId: user.user_id.toString(), username: user.username }
      );
    }

    for (const fav of favorites) {
      await session.run(
        `MATCH (u:User {userId: $userId}), (m:Movie {movieId: $movieId}) MERGE (u)-[:FAVORITE]->(m)`,
        { userId: fav.user_id.toString(), movieId: fav.movie_id.toString() }
      );
    }

  } catch (error) {
    console.error('Seed error:', error);
    throw error;
  } finally {
    await session.close();
  }
}
module.exports = {
  seedNeo4j,
};
