-- Files each recipe by its tags, compared by tag key. The chapter is the one named by its first tag
-- that names one, in the words an import's categories name chapters by (src/domain/recipe/chapter.ts),
-- or This & That. The holidays and diets are those a tag names, in the vocabulary's order, with the
-- diets Vegan implies (src/domain/recipe/diet.ts).
UPDATE "recipes" SET
	"chapter" = coalesce(
		(
			SELECT "names"."chapter"
			FROM unnest("recipes"."tag_keys") WITH ORDINALITY AS "tags"("key", "position")
			JOIN (
				VALUES
					('breakfast', 'breakfast-brunch'),
					('brunch', 'breakfast-brunch'),
					('appetizer', 'appetizers-beverages'),
					('appetizers', 'appetizers-beverages'),
					('starter', 'appetizers-beverages'),
					('starters', 'appetizers-beverages'),
					('snack', 'appetizers-beverages'),
					('snacks', 'appetizers-beverages'),
					('hors d’oeuvres', 'appetizers-beverages'),
					('hors d''oeuvres', 'appetizers-beverages'),
					('beverage', 'appetizers-beverages'),
					('beverages', 'appetizers-beverages'),
					('drink', 'appetizers-beverages'),
					('drinks', 'appetizers-beverages'),
					('cocktail', 'appetizers-beverages'),
					('cocktails', 'appetizers-beverages'),
					('soup', 'soups-salads'),
					('soups', 'soups-salads'),
					('salad', 'soups-salads'),
					('salads', 'soups-salads'),
					('stew', 'soups-salads'),
					('stews', 'soups-salads'),
					('side', 'vegetables-sides'),
					('sides', 'vegetables-sides'),
					('side dish', 'vegetables-sides'),
					('side dishes', 'vegetables-sides'),
					('vegetable', 'vegetables-sides'),
					('vegetables', 'vegetables-sides'),
					('main', 'main-dishes'),
					('mains', 'main-dishes'),
					('main course', 'main-dishes'),
					('main courses', 'main-dishes'),
					('main dish', 'main-dishes'),
					('main dishes', 'main-dishes'),
					('dinner', 'main-dishes'),
					('entree', 'main-dishes'),
					('entrees', 'main-dishes'),
					('entrée', 'main-dishes'),
					('entrées', 'main-dishes'),
					('bread', 'breads-rolls'),
					('breads', 'breads-rolls'),
					('quick bread', 'breads-rolls'),
					('quick breads', 'breads-rolls'),
					('roll', 'breads-rolls'),
					('rolls', 'breads-rolls'),
					('dessert', 'desserts'),
					('desserts', 'desserts'),
					('cake', 'desserts'),
					('cakes', 'desserts'),
					('pie', 'desserts'),
					('pies', 'desserts'),
					('cookie', 'cookies-candy'),
					('cookies', 'cookies-candy'),
					('candy', 'cookies-candy'),
					('candies', 'cookies-candy'),
					('bars', 'cookies-candy'),
					('fudge', 'cookies-candy'),
					('sauce', 'this-and-that'),
					('sauces', 'this-and-that'),
					('condiment', 'this-and-that'),
					('condiments', 'this-and-that'),
					('preserves', 'this-and-that')
			) AS "names"("key", "chapter") ON "names"."key" = "tags"."key"
			ORDER BY "tags"."position"
			LIMIT 1
		),
		'this-and-that'
	),
	"holidays" = ARRAY(
		SELECT "names"."holiday"
		FROM (
			VALUES
				(1, 'new-years-day', ARRAY['new year’s day', 'new year''s day', 'new years day']),
				(2, 'st-patricks-day', ARRAY[
					'st. patrick’s day',
					'st. patrick''s day',
					'st patrick’s day',
					'st patrick''s day',
					'saint patrick’s day',
					'saint patrick''s day'
				]),
				(3, 'easter', ARRAY['easter']),
				(4, 'fourth-of-july', ARRAY['fourth of july', '4th of july', 'independence day']),
				(5, 'halloween', ARRAY['halloween']),
				(6, 'thanksgiving', ARRAY['thanksgiving']),
				(7, 'christmas', ARRAY['christmas'])
		) AS "names"("position", "holiday", "keys")
		WHERE "names"."keys" && "recipes"."tag_keys"
		ORDER BY "names"."position"
	),
	"diets" = ARRAY(
		SELECT "names"."diet"
		FROM (
			VALUES
				(1, 'vegetarian', ARRAY['vegetarian', 'vegan']),
				(2, 'vegan', ARRAY['vegan']),
				(3, 'gluten-free', ARRAY['gluten-free', 'gluten free']),
				(4, 'dairy-free', ARRAY['dairy-free', 'dairy free', 'vegan'])
		) AS "names"("position", "diet", "keys")
		WHERE "names"."keys" && "recipes"."tag_keys"
		ORDER BY "names"."position"
	);
